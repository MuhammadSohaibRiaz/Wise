import type { SupabaseClient } from "@supabase/supabase-js"

/** Recompute average_rating from published reviews. Success rate is case-outcome based (see script 059). */
export async function recomputeLawyerRatingStats(supabase: SupabaseClient, lawyerId: string) {
  const { data: rows } = await supabase
    .from("reviews")
    .select("rating")
    .eq("reviewee_id", lawyerId)
    .eq("status", "published")

  const ratings = (rows || []).map((r) => r.rating).filter((n): n is number => typeof n === "number")
  const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0

  await supabase
    .from("lawyer_profiles")
    .update({
      average_rating: Math.round(avg * 100) / 100,
    })
    .eq("id", lawyerId)
}
