import type { SupabaseClient } from "@supabase/supabase-js"

const SUCCESS_OUTCOMES = ["won", "settled"] as const

/** Success rate = (won + settled) / completed cases × 100 for this lawyer. */
export async function recomputeLawyerSuccessRate(supabase: SupabaseClient, lawyerId: string) {
  const { data: rows, error } = await supabase
    .from("cases")
    .select("case_outcome")
    .eq("lawyer_id", lawyerId)
    .eq("status", "completed")

  if (error) {
    console.error("[recomputeLawyerSuccessRate]", error.message)
    return { successRate: 0, completedCount: 0 }
  }

  const completed = rows || []
  const completedCount = completed.length
  const wins = completed.filter((c) =>
    SUCCESS_OUTCOMES.includes((c.case_outcome || "") as (typeof SUCCESS_OUTCOMES)[number]),
  ).length

  const successRate =
    completedCount > 0 ? Math.round((wins / completedCount) * 10000) / 100 : 0

  await supabase
    .from("lawyer_profiles")
    .update({
      success_rate: successRate,
      total_cases: completedCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", lawyerId)

  return { successRate, completedCount }
}
