import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { processAnalysisJob } from "@/lib/analysis/process-analysis-job"
import { applySimpleRateLimit } from "@/lib/rate-limit"

/**
 * Poll analysis job status. If still pending, attempts to run the job (lazy worker).
 */
export async function GET(req: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    const throttle = applySimpleRateLimit({
      namespace: "analysis-job-poll",
      key: `${user.id}:${jobId}:${ip}`,
      limit: 90,
      windowMs: 60_000,
    })
    if (!throttle.ok) {
      return NextResponse.json(
        { error: "Too many polling requests. Please slow down." },
        { status: 429, headers: { "Retry-After": String(throttle.retryAfterSec) } },
      )
    }

    const { data: job, error } = await supabase
      .from("document_analysis_jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle()

    if (error || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    if (job.requested_by !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (job.status === "pending") {
      await processAnalysisJob(jobId)
    }

    const { data: refreshed } = await supabase.from("document_analysis_jobs").select("*").eq("id", jobId).single()

    return NextResponse.json(refreshed)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
