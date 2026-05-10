import type { SupabaseClient } from "@supabase/supabase-js"

export interface CaseDraftRow {
  id: string
  client_id: string
  title: string | null
  draft_status: "draft" | "ready_to_book" | "converted"
  linked_document_id: string | null
  linked_analysis_id: string | null
  selected_lawyer_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

/**
 * Persists post-analysis state server-side (reduces reliance on sessionStorage).
 * Requires migration 043 (`case_drafts` table + unique index on client_id + linked_document_id).
 */
export async function upsertCaseDraftAfterAnalysis(
  supabase: SupabaseClient,
  params: {
    clientId: string
    linkedDocumentId: string
    linkedAnalysisId: string
    title?: string | null
  },
): Promise<{ ok: boolean; error?: string }> {
  const row = {
    client_id: params.clientId,
    title: params.title?.trim() || "Consultation draft",
    draft_status: "ready_to_book" as const,
    linked_document_id: params.linkedDocumentId,
    linked_analysis_id: params.linkedAnalysisId,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from("case_drafts").upsert(row, {
    onConflict: "client_id,linked_document_id",
  })

  if (error) {
    console.warn("[case-drafts] upsert skipped:", error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

export async function getLatestReadyDraftForClient(
  supabase: SupabaseClient,
  clientId: string,
  lawyerId?: string,
): Promise<CaseDraftRow | null> {
  let q = supabase
    .from("case_drafts")
    .select("*")
    .eq("client_id", clientId)
    .in("draft_status", ["draft", "ready_to_book"])
    .order("updated_at", { ascending: false })
    .limit(1)

  if (lawyerId) {
    q = q.or(`selected_lawyer_id.eq.${lawyerId},selected_lawyer_id.is.null`)
  }

  const { data, error } = await q.maybeSingle()
  if (error) {
    console.warn("[case-drafts] read skipped:", error.message)
    return null
  }
  return (data as CaseDraftRow | null) ?? null
}

export async function markLatestDraftLawyerSelection(
  supabase: SupabaseClient,
  clientId: string,
  lawyerId: string,
): Promise<{ ok: boolean; error?: string }> {
  const draft = await getLatestReadyDraftForClient(supabase, clientId)
  if (!draft) return { ok: false, error: "no_draft" }

  const { error } = await supabase
    .from("case_drafts")
    .update({
      selected_lawyer_id: lawyerId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", draft.id)

  if (error) {
    console.warn("[case-drafts] select lawyer skipped:", error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

export async function markCaseDraftConverted(
  supabase: SupabaseClient,
  draftId: string,
  caseId: string,
  lawyerId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("case_drafts")
    .update({
      draft_status: "converted",
      selected_lawyer_id: lawyerId,
      metadata: { converted_case_id: caseId, converted_at: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    })
    .eq("id", draftId)

  if (error) {
    console.warn("[case-drafts] convert skipped:", error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}
