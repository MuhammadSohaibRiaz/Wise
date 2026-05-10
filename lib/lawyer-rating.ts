/**
 * All lawyer summary UIs should use `lawyer_profiles.average_rating` from Supabase,
 * normalized through these helpers so stars match everywhere.
 */
export function normalizeLawyerAverageRating(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

export function formatLawyerRatingLabel(rating: number): string {
  return rating > 0 ? rating.toFixed(1) : "New"
}
