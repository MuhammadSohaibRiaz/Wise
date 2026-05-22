/**
 * Fact-grounding helpers for document analysis.
 * Ensures summaries align with extracted document text where possible.
 */

export type DocumentAnchors = {
  amounts: string[]
  dates: string[]
  names: string[]
  sections: string[]
  places: string[]
  firReferences: string[]
  evidenceMarkers: boolean
}

export type GroundingValidationResult = {
  passed: boolean
  score: number
  unsupportedClaims: string[]
}

const WEAK_EXTRACTION_MARKERS = [
  "[Image Document - Analyzed directly via Vision AI]",
  "[Word Document - Raw text extraction unavailable",
  "Please analyze the attached image document directly",
]

const COMMON_WORDS = new Set(
  [
    "the",
    "and",
    "for",
    "with",
    "from",
    "this",
    "that",
    "document",
    "legal",
    "law",
    "pakistan",
    "pakistani",
    "case",
    "court",
    "police",
    "station",
    "complainant",
    "accused",
    "section",
    "penal",
    "code",
    "criminal",
    "civil",
    "first",
    "information",
    "report",
    "fir",
    "lahore",
    "punjab",
    "under",
    "act",
    "ppc",
  ].map((w) => w.toLowerCase()),
)

const EVIDENCE_KEYWORDS =
  /\b(witness|receipt|bank\s*transfer|attachment|evidence|allotment|screenshot|whatsapp|fir\b|payment)/i

const STANDARD_PPC_SECTIONS = [
  "420",
  "406",
  "468",
  "471",
  "379",
  "302",
  "376",
  "489",
]

export function isWeakExtraction(text: string): boolean {
  const t = text.trim()
  if (!t || t.length < 80) return true
  return WEAK_EXTRACTION_MARKERS.some((m) => t.includes(m))
}

export function extractDocumentAnchors(text: string): DocumentAnchors {
  const source = text.slice(0, 120_000)

  const amounts = new Set<string>()
  for (const m of source.matchAll(
    /(?:Rs\.?|PKR|₨)\s*([\d,]+(?:\.\d+)?)\s*(?:lakh|lac|crore|million)?/gi,
  )) {
    amounts.add(normalizeAmount(m[0]))
  }
  for (const m of source.matchAll(/\b([\d,]+)\s*(?:lakh|lac|crore)\b/gi)) {
    amounts.add(normalizeAmount(m[0]))
  }

  const dates = new Set<string>()
  for (const m of source.matchAll(
    /\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})\b/gi,
  )) {
    dates.add(m[0].trim())
  }

  const names = new Set<string>()
  for (const m of source.matchAll(
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+s\/o\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
  )) {
    names.add(m[1].trim())
    if (m[2]) names.add(m[2].trim())
  }
  for (const m of source.matchAll(/\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/g)) {
    const candidate = m[1].trim()
    if (!isCommonPhrase(candidate)) names.add(candidate)
  }

  const sections = new Set<string>()
  for (const m of source.matchAll(/\b(?:section|sec\.?)\s*(\d+[A-Za-z]?)\b/gi)) {
    sections.add(m[1])
  }
  for (const s of STANDARD_PPC_SECTIONS) {
    if (new RegExp(`\\b${s}\\b`).test(source)) sections.add(s)
  }

  const places = new Set<string>()
  for (const m of source.matchAll(
    /\b(Gulberg|Lahore|Karachi|Islamabad|Rawalpindi|DHA|Police Station|District)\b/gi,
  )) {
    places.add(m[0].trim())
  }

  const firReferences: string[] = []
  const firMatch = source.match(/\bFIR\s*(?:No\.?|Number)?\s*[:#]?\s*([\w/-]+)/i)
  if (firMatch) firReferences.push(firMatch[0].trim())

  return {
    amounts: [...amounts],
    dates: [...dates],
    names: [...names].slice(0, 12),
    sections: [...sections],
    places: [...places],
    firReferences,
    evidenceMarkers: EVIDENCE_KEYWORDS.test(source),
  }
}

function normalizeAmount(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().toLowerCase()
}

function normalizeDigits(value: string): string {
  return value.replace(/[^\d]/g, "")
}

function isCommonPhrase(phrase: string): boolean {
  const words = phrase.toLowerCase().split(/\s+/)
  return words.every((w) => COMMON_WORDS.has(w))
}

function textContainsAmount(source: string, amount: string): boolean {
  const digits = normalizeDigits(amount)
  if (!digits || digits.length < 3) return true
  return normalizeDigits(source).includes(digits)
}

function textContainsName(source: string, name: string): boolean {
  const parts = name.toLowerCase().split(/\s+/).filter((p) => p.length > 2)
  if (parts.length === 0) return true
  const lower = source.toLowerCase()
  return parts.every((p) => lower.includes(p))
}

export function validateAnalysisGrounding(input: {
  summary: string
  keyTerms: string[]
  extractedText: string
  documentFacts?: string[]
}): GroundingValidationResult {
  const { summary, keyTerms, extractedText, documentFacts = [] } = input

  if (isWeakExtraction(extractedText)) {
    return { passed: true, score: 0.5, unsupportedClaims: [] }
  }

  const source = `${extractedText}\n${documentFacts.join("\n")}`.toLowerCase()
  const anchors = extractDocumentAnchors(extractedText)
  const unsupportedClaims: string[] = []

  for (const amount of extractAmountsFromText(summary)) {
    if (!textContainsAmount(source, amount) && !anchors.amounts.some((a) => textContainsAmount(a, amount))) {
      unsupportedClaims.push(`Amount "${amount}" not found in document text`)
    }
  }

  for (const name of extractNamesFromText(summary)) {
    if (
      !textContainsName(source, name) &&
      !anchors.names.some((n) => textContainsName(n.toLowerCase(), name))
    ) {
      unsupportedClaims.push(`Name "${name}" not found in document text`)
    }
  }

  for (const term of keyTerms) {
    if (typeof term !== "string" || term.length < 4) continue
    const lower = term.toLowerCase()
    if (COMMON_WORDS.has(lower)) continue
    if (STANDARD_PPC_SECTIONS.includes(lower.replace(/\D/g, ""))) continue
    if (!source.includes(lower) && !summary.toLowerCase().includes(lower)) {
      unsupportedClaims.push(`Key term "${term}" not grounded in source`)
    }
  }

  const passed = unsupportedClaims.length === 0
  const score = passed ? 1 : Math.max(0, 1 - unsupportedClaims.length * 0.2)

  return { passed, score, unsupportedClaims }
}

function extractAmountsFromText(text: string): string[] {
  const found: string[] = []
  for (const m of text.matchAll(/(?:Rs\.?|PKR|₨)?\s*([\d,]+(?:\.\d+)?)\s*(?:lakh|lac|crore)?/gi)) {
    if (m[0]) found.push(m[0])
  }
  return found
}

function extractNamesFromText(text: string): string[] {
  const found: string[] = []
  for (const m of text.matchAll(/\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/g)) {
    const name = m[1].trim()
    if (!isCommonPhrase(name)) found.push(name)
  }
  return found.slice(0, 6)
}

export function buildFactOnlySummary(anchors: DocumentAnchors, extractedText: string): string {
  const parts: string[] = []

  if (anchors.firReferences.length > 0) {
    parts.push(`This document appears to be an FIR (${anchors.firReferences[0]}).`)
  } else if (/\bFIR\b/i.test(extractedText)) {
    parts.push("This document appears to be a First Information Report (FIR).")
  }

  if (anchors.names.length >= 2) {
    parts.push(`It names ${anchors.names[0]} and ${anchors.names[1]}.`)
  } else if (anchors.names.length === 1) {
    parts.push(`It references ${anchors.names[0]}.`)
  }

  if (anchors.amounts.length > 0) {
    parts.push(`A monetary amount mentioned is ${anchors.amounts[0]}.`)
  }

  if (anchors.places.length > 0) {
    parts.push(`Location references include ${anchors.places.slice(0, 2).join(" and ")}.`)
  }

  if (parts.length > 0) {
    return parts.join(" ").slice(0, 600)
  }

  const excerpt = extractedText.replace(/\s+/g, " ").trim().slice(0, 400)
  if (excerpt.length > 60) {
    return `Based only on the uploaded document text: ${excerpt}${excerpt.length >= 400 ? "…" : ""}`
  }

  return "The document text could not be read clearly enough for a detailed summary. Please upload a clearer scan or PDF."
}

export function computePositionScore(input: {
  isLegal: boolean
  groundingPassed: boolean
  confidenceScore: number | null
  anchors: DocumentAnchors
  riskLevel: string
}): number {
  if (!input.isLegal) return 0

  let score = 50
  if (input.groundingPassed) score += 10
  if (input.confidenceScore != null && input.confidenceScore >= 0.7) score += 10
  if (input.anchors.evidenceMarkers) score += 10

  if (input.riskLevel === "High") score -= 10
  else if (input.riskLevel === "Medium") score -= 5

  return Math.min(100, Math.max(0, score))
}

export const GROUNDING_DISCLAIMER_APPENDIX =
  " Some details in the initial draft could not be verified against the document text; the summary above is limited to text found in your upload."
