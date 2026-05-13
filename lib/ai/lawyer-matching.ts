import type { SupabaseClient } from "@supabase/supabase-js"

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Match lawyers whose specializations overlap the given category or text hint (works server + browser). */
export async function matchLawyersWithCategory(supabase: SupabaseClient, category: string) {
  if (!category || typeof category !== "string") return []
  // Search for lawyers whose specializations array contains the category
  const { data, error } = await supabase
    .from("profiles")
    .select(
      `
      id,
      first_name,
      last_name,
      avatar_url,
      bio,
      location,
      availability_status,
      lawyer_profiles (
        specializations,
        average_rating,
        total_cases,
        hourly_rate,
        success_rate,
        verified
      )
    `,
    )
    .eq("user_type", "lawyer")

  if (error) {
    console.error("Error fetching lawyers for matching:", error)
    return []
  }

  const STOP_WORDS = new Set(['law', 'legal', 'and', 'practice', 'specialist', 'specialization', 'expert'])
  const categoryKeywords = category.toLowerCase()
    .split(/\s+/)
    .map(w => w.replace(/[^a-z0-9]/g, ""))
    .filter(word => word.length > 2 && !STOP_WORDS.has(word))

  if (categoryKeywords.length === 0 && category.length > 0) {
    // If all words were stop words, just use the original category lowercased
    categoryKeywords.push(category.toLowerCase())
  }

  // 2. Filter and score lawyers
  const matchedLawyers = (data || [])
    .filter((lawyer: any) => {
      const profile = Array.isArray(lawyer.lawyer_profiles)
        ? lawyer.lawyer_profiles[0]
        : lawyer.lawyer_profiles
      
      if (!profile || !profile.specializations) return false
      
      // Strict match: At least one non-stopword keyword must match as a WHOLE WORD
      return profile.specializations.some((spec: string) => {
        const specLower = spec.toLowerCase()
        return categoryKeywords.some(keyword => {
          const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'i')
          return regex.test(specLower)
        })
      })
    })
    .map((lawyer: any) => {
      const profile = Array.isArray(lawyer.lawyer_profiles)
        ? lawyer.lawyer_profiles[0]
        : lawyer.lawyer_profiles

      const score = calculateMatchScore(profile, category, categoryKeywords)
      
      return {
        id: lawyer.id,
        name: `${lawyer.first_name} ${lawyer.last_name}`,
        avatar_url: lawyer.avatar_url,
        location: lawyer.location ?? null,
        specializations: profile.specializations,
        rating: Number(profile.average_rating) || 0,
        hourly_rate: Number(profile.hourly_rate) || 0,
        success_rate: Number(profile.success_rate) || 0,
        verified: profile.verified === true,
        match_score: score,
      }
    })
    // Filter out irrelevant results with low scores (ensures at least one keyword/exact match)
    .filter(lawyer => lawyer.match_score >= 50)
    // Sort by match score then rating
    .sort((a, b) => b.match_score - a.match_score || b.rating - a.rating)
    // Only return top matches to keep it focused
    .slice(0, 6)

  return matchedLawyers
}

function calculateMatchScore(profile: any, category: string, categoryKeywords: string[]) {
  let score = 0
  
  const specStrings = (profile.specializations || []).map((s: string) => s.toLowerCase())

  // 1. Exact match bonus (Highest priority)
  if (specStrings.some((s: string) => s === category.toLowerCase())) {
    score += 100
  }
  
  categoryKeywords.forEach(keyword => {
    const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'i')
    if (specStrings.some((s: string) => regex.test(s))) {
      score += 50
    }
  })
  
  // 3. Rating bonus (Secondary priority)
  score += (profile.average_rating || 0) * 5
  
  // 4. Verification bonus
  if (profile.verified) score += 20
  
  // 5. Success rate bonus
  score += (profile.success_rate || 0) / 10

  return score
}

/** Build a short (≤120 char) client-side explanation for why a lawyer is recommended. */
export function generateRecommendationReason(params: {
  specializations: string[]
  rating: number
  caseType?: string | null
  verified?: boolean
  totalCases?: number
}): string {
  const { specializations: rawSpecs, rating, caseType, verified, totalCases } = params
  const specializations = rawSpecs || []
  const topSpec = specializations[0] || "General Practice"
  const ratingStr = rating > 0 ? `${rating.toFixed(1)}★` : null

  if (caseType) {
    const caseTypeLower = caseType.toLowerCase()
    const matchingSpec = specializations.find(
      (s) => s.toLowerCase().includes(caseTypeLower) || caseTypeLower.includes(s.toLowerCase()),
    )
    if (matchingSpec) {
      let r = `Matched for your ${caseType} case`
      if (ratingStr) r += ` · ${ratingStr} rated`
      if (verified) r += " · Verified"
      return r.length > 120 ? r.slice(0, 117) + "…" : r
    }
  }

  let r = `Specializes in ${topSpec}`
  if (ratingStr) r += ` · ${ratingStr} rated`
  if (totalCases && totalCases > 0) r += ` · ${totalCases} cases`
  else if (verified) r += " · Verified"
  return r.length > 120 ? r.slice(0, 117) + "…" : r
}
