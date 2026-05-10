import { createAdminClient } from "@/lib/supabase/admin"
import { runDocumentAnalysis } from "@/lib/analysis/run-document-analysis"

/** Atomically claims one pending job (pending → processing). Returns null if nothing to claim. */
async function claimNextPendingJob(jobId?: string) {
  const admin = createAdminClient()

  if (jobId) {
    const { data, error } = await admin
      .from("document_analysis_jobs")
      .update({
        status: "processing",
        started_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .eq("status", "pending")
      .select("id, document_id, requested_by")
      .maybeSingle()

    if (error) throw error
    return data
  }

  const { data: row, error: selErr } = await admin
    .from("document_analysis_jobs")
    .select("id")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (selErr) throw selErr
  if (!row?.id) return null

  const { data, error } = await admin
    .from("document_analysis_jobs")
    .update({
      status: "processing",
      started_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("status", "pending")
    .select("id, document_id, requested_by")
    .maybeSingle()

  if (error) throw error
  return data
}

export async function processAnalysisJob(jobId: string): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient()

  let job: { id: string; document_id: string; requested_by: string } | null = null
  try {
    job = await claimNextPendingJob(jobId)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "claim failed"
    return { ok: false, error: msg }
  }

  if (!job) {
    return { ok: false, error: "job_not_claimable" }
  }

  try {
    const result = await runDocumentAnalysis(admin, {
      documentId: job.document_id,
      userId: job.requested_by,
    })

    await admin
      .from("document_analysis_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        result_payload: result as unknown as Record<string, unknown>,
        error_message: null,
      })
      .eq("id", job.id)

    return { ok: true }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Analysis failed"
    await admin.from("documents").update({ status: "failed" }).eq("id", job.document_id)

    await admin
      .from("document_analysis_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: message,
      })
      .eq("id", job.id)

    return { ok: false, error: message }
  }
}

/** Cron: process up to `limit` pending jobs in order. */
export async function processPendingAnalysisJobs(limit = 5): Promise<{ processed: number }> {
  let processed = 0
  const admin = createAdminClient()
  for (let i = 0; i < limit; i++) {
    const { data: row } = await admin
      .from("document_analysis_jobs")
      .select("id")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!row?.id) break

    const r = await processAnalysisJob(row.id)
    if (r.ok) processed += 1
    else if (r.error === "job_not_claimable") continue
    else break
  }
  return { processed }
}
