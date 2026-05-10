/** Canonical practice areas — keep in sync across registration, lawyer profile, and AI matching. */
export const LAW_SPECIALIZATIONS = [
  "Corporate Law",
  "Family Law",
  "Real Estate",
  "Criminal Law",
  "Immigration",
  "Tax Law",
  "Labor Law",
  "Intellectual Property",
  "Bankruptcy",
  "Civil Law",
] as const

export type LawSpecialization = (typeof LAW_SPECIALIZATIONS)[number]
