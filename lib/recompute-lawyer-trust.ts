import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Lightweight trust score 0–100 (Phase 1 heuristic).
 * Tune weights when dispute aggregates / reviews are reliable.
 */
export async function recomputeLawyerTrustScore(
  supabase: SupabaseClient,
  lawyerId: string,
): Promise<number | null> {
  const { data: lp, error } = await supabase
    .from("lawyer_profiles")
    .select("verified, ai_license_match")
    .eq("id", lawyerId)
    .single()

  if (error || !lp) {
    console.warn("[trust] load lawyer_profiles:", error?.message)
    return null
  }

  let score = 0
  if (lp.verified === true) score += 50
  if (lp.ai_license_match === true) score += 20

  const { count: completedCases } = await supabase
    .from("cases")
    .select("*", { count: "exact", head: true })
    .eq("lawyer_id", lawyerId)
    .eq("status", "completed")

  const cc = completedCases ?? 0
  score += Math.min(10, cc * 2)

  const { data: reviews } = await supabase
    .from("reviews")
    .select("rating")
    .eq("reviewee_id", lawyerId)
    .eq("status", "published")

  const ratings = (reviews || []).map((r: { rating: number }) => r.rating).filter((n) => Number.isFinite(n))
  if (ratings.length > 0) {
    const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length
    if (avg >= 4) score += 10
    else if (avg >= 3) score += 5
  }

  score = Math.min(100, Math.max(0, score))

  const verConf =
    lp.verified === true ? (lp.ai_license_match === true ? 0.95 : lp.ai_license_match === false ? 0.65 : 0.85) : 0.35

  const { error: upErr } = await supabase
    .from("lawyer_profiles")
    .update({
      trust_score: score,
      verification_confidence: verConf,
    })
    .eq("id", lawyerId)

  if (upErr) {
    console.warn("[trust] update skipped (migration 043?):", upErr.message)
    return score
  }

  return score
}
