import type { SupabaseClient } from "@supabase/supabase-js"

/** Open / in-review disputes — source of truth for “this case is disputed” (not `cases.status`). */
const OPEN_DISPUTE_STATUSES = ["open", "under_review"] as const

export async function getOpenDisputeCaseIds(
  supabase: SupabaseClient,
  caseIds: string[],
): Promise<Set<string>> {
  if (caseIds.length === 0) return new Set()

  const { data, error } = await supabase
    .from("case_disputes")
    .select("case_id")
    .in("case_id", caseIds)
    .in("status", [...OPEN_DISPUTE_STATUSES])

  if (error || !data) return new Set()
  return new Set(data.map((r) => r.case_id as string))
}
