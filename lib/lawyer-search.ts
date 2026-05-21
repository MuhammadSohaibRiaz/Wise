import type { SupabaseClient } from "@supabase/supabase-js"
import { APP_CURRENCY, formatConsultationFeeBase } from "@/lib/currency"

export type LawyerSearchHit = {
  id: string
  name: string
  avatar: string | null
  specializations: string[]
  /** Stored fee for a standard 60-minute consultation (PKR). */
  hourly_rate: number | null | undefined
  currency: typeof APP_CURRENCY
  consultation_fee_pkr: number | null
  consultation_fee_display: string | null
}

export function enrichLawyerSearchHit(lawyer: Omit<LawyerSearchHit, "currency" | "consultation_fee_pkr" | "consultation_fee_display">): LawyerSearchHit {
  const fee = lawyer.hourly_rate != null && Number(lawyer.hourly_rate) > 0 ? Number(lawyer.hourly_rate) : null
  return {
    ...lawyer,
    currency: APP_CURRENCY,
    consultation_fee_pkr: fee,
    consultation_fee_display: fee != null ? formatConsultationFeeBase(fee) : null,
  }
}

type PracticeAreaIntent = {
  label: string
  matchesSpecialization: (value: string) => boolean
}

function detectPracticeAreaIntent(value: string): PracticeAreaIntent | null {
  // Normalize natural-language English/Urdu requests into a strict practice
  // area filter. This prevents "family law" searches from returning unrelated
  // tax/labour lawyers just because their names matched generic tokens.
  const text = value.toLowerCase()

  const intents: Array<{ label: string; queryPattern: RegExp; specializationPattern: RegExp }> = [
    {
      label: "Family Law",
      queryPattern:
        /family|matrimonial|divorce|divoce|khula|custody|guardian|ward|maintenance|\u0641\u06CC\u0645\u0644\u06CC|\u062E\u0627\u0646\u062F\u0627\u0646\u06CC|\u0637\u0644\u0627\u0642|\u062E\u0644\u0639|\u062D\u0636\u0627\u0646\u062A|\u0646\u0641\u0642\u06C1/,
      specializationPattern: /family|matrimonial|divorce|custody|guardian|maintenance/i,
    },
    {
      label: "Criminal Law",
      queryPattern:
        /criminal|crime|fir|bail|murder|theft|offence|offense|\u0641\u0648\u062C\u062F\u0627\u0631\u06CC|\u062C\u0631\u0645|\u0636\u0645\u0627\u0646\u062A|\u0642\u062A\u0644|\u0686\u0648\u0631\u06CC/,
      specializationPattern: /criminal|crime|fir|bail|offence|offense/i,
    },
    {
      label: "Tax Law",
      queryPattern: /tax|income tax|sales tax|fbr|\u0679\u06CC\u06A9\u0633|\u0627\u0646\u06A9\u0645|\u0633\u06CC\u0644\u0632/,
      specializationPattern: /tax|income tax|sales tax|fbr/i,
    },
    {
      label: "Labour Law",
      queryPattern: /labou?r|employment|worker|employer|\u0644\u06CC\u0628\u0631|\u0645\u0644\u0627\u0632\u0645\u062A|\u06A9\u0627\u0631\u06A9\u0646/,
      specializationPattern: /labou?r|employment|worker|service/i,
    },
    {
      label: "Property Law",
      queryPattern:
        /property|land|real estate|transfer|mortgage|lease|tenant|landlord|\u062C\u0627\u0626\u06CC\u062F\u0627\u062F|\u0632\u0645\u06CC\u0646|\u0627\u0631\u0627\u0636\u06CC|\u0645\u0627\u0631\u06AF\u06CC\u062C|\u06A9\u0631\u0627\u06CC\u06C1/,
      specializationPattern: /real\s*estate|property|land|transfer|mortgage|lease|tenant|landlord/i,
    },
    {
      label: "Civil Law",
      queryPattern: /civil|contract|agreement|suit|plaint|\u062F\u06CC\u0648\u0627\u0646\u06CC|\u0645\u0639\u0627\u06C1\u062F\u06C1|\u062F\u0639\u0648\u06CC/,
      specializationPattern: /civil|contract|agreement|litigation/i,
    },
    {
      label: "Immigration Law",
      queryPattern: /immigration|emigration|overseas|visa|\u0627\u0645\u06CC\u06AF\u0631\u06CC\u0634\u0646|\u0648\u06CC\u0632\u0627|\u0628\u06CC\u0631\u0648\u0646/,
      specializationPattern: /immigration|emigration|overseas|visa/i,
    },
  ]

  const match = intents.find((intent) => intent.queryPattern.test(text))
  if (!match) return null

  return {
    label: match.label,
    matchesSpecialization: (value: string) => match.specializationPattern.test(value),
  }
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
  const requestedPracticeArea = detectPracticeAreaIntent(raw)
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

  const candidates = requestedPracticeArea
    ? rows.filter((lawyer) => lawyer.specializations.some((specialization) => requestedPracticeArea.matchesSpecialization(specialization)))
    : rows

  // Score name/specialization text after the hard practice-area filter. That
  // gives relevant specialties priority while still allowing name searches.
  const scored = candidates
    .map((l) => {
      const blob = `${l.name} ${l.specializations.join(" ")}`.toLowerCase()
      let score = 0
      if (raw) {
        if (blob.includes(raw)) score += 5
        tokens.forEach((w) => {
          if (blob.includes(w)) score += 2
        })
      }
      if (requestedPracticeArea) {
        if (l.specializations.some((s) => requestedPracticeArea.matchesSpecialization(s))) score += 8
        if (requestedPracticeArea.matchesSpecialization(blob)) score += 3
      }
      if (!raw) score += 0.1
      return { ...l, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)

  const lawyers = scored.slice(0, 8).map(({ score: _s, ...rest }) => enrichLawyerSearchHit(rest))
  return {
    lawyers,
    note:
      lawyers.length === 0
        ? requestedPracticeArea
          ? `No public lawyer profile matched ${requestedPracticeArea.label}.`
          : "No public lawyer profile matched that name or specialty."
        : undefined,
  }
}
