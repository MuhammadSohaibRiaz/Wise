import type { SupabaseClient } from "@supabase/supabase-js"

export type LawyerSearchHit = {
  id: string
  name: string
  avatar: string | null
  specializations: string[]
  hourly_rate: number | null | undefined
}

/**
 * Shared lawyer search (name + specialty tokens). Used by `/api/lawyers/search` and the chat tool.
 */
export async function searchLawyersFromSupabase(
  supabase: SupabaseClient,
  input: { specialty?: string; query?: string },
): Promise<{ lawyers: LawyerSearchHit[]; error?: string; note?: string }> {
  const specialty = (input?.specialty || "").trim()
  const query = (input?.query || "").trim()
  const raw = `${specialty} ${query}`.toLowerCase().trim()
  const stop = new Set([
    "lawyer",
    "lawyers",
    "advocate",
    "attorney",
    "about",
    "tell",
    "please",
    "details",
    "some",
    "information",
    "your",
    "the",
    "and",
    "for",
    "with",
    "from",
    "this",
    "that",
    "what",
    "who",
    "how",
    "let",
    "know",
    "need",
  ])
  const tokens = raw
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9\u0600-\u06FF]/gi, ""))
    .filter((w) => w.length > 2 && !stop.has(w))

  const wantsRealEstate =
    raw.includes("real estate") || raw.includes("property") || raw.includes("land law") || raw.includes("lease")

  const { data, error } = await supabase
    .from("profiles")
    .select(
      `
          id,
          first_name,
          last_name,
          avatar_url,
          lawyer_profiles (
            specializations,
            hourly_rate
          )
        `,
    )
    .eq("user_type", "lawyer")
    .limit(80)

  if (error) return { lawyers: [], error: error.message }

  const rows = (data || []).map((l: any) => {
    const lp = Array.isArray(l.lawyer_profiles) ? l.lawyer_profiles[0] : l.lawyer_profiles
    const specs: string[] = Array.isArray(lp?.specializations) ? lp.specializations : []
    return {
      id: l.id as string,
      name: `${l.first_name || ""} ${l.last_name || ""}`.trim(),
      avatar: l.avatar_url as string | null,
      specializations: specs,
      hourly_rate: lp?.hourly_rate as number | null | undefined,
    }
  })

  const scored = rows
    .map((l) => {
      const blob = `${l.name} ${l.specializations.join(" ")}`.toLowerCase()
      let score = 0
      if (raw) {
        if (blob.includes(raw)) score += 5
        tokens.forEach((w) => {
          if (blob.includes(w)) score += 2
        })
      }
      if (wantsRealEstate) {
        if (l.specializations.some((s) => /real\s*estate|property|land/i.test(s))) score += 5
        if (/real\s*estate|property|land/i.test(blob)) score += 2
      }
      if (!raw) score += 0.1
      return { ...l, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)

  const lawyers = scored.slice(0, 8).map(({ score: _s, ...rest }) => rest)
  return {
    lawyers,
    note:
      lawyers.length === 0
        ? "No public lawyer profile matched that name or specialty."
        : undefined,
  }
}
