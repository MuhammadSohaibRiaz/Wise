/**
 * Shared heuristics for Legal RAG routing (API) and loading UI copy.
 * API classification in legal-rag-chat/route.ts remains authoritative.
 */

export type LoadingPhraseCategory = "profile" | "lawyerSearch" | "accountSummary" | "legal" | "default"

/** Pakistani statute / legal KB question — must not use platform tools. */
export function isPakistaniLegalStatuteQuestion(query: string): boolean {
  const normalized = query.toLowerCase().replace(/\s+/g, " ").trim()
  if (normalized.length < 4) return false

  const legalStatutePattern =
    /\b(section|sections|act|ordinance|statute|ppc|penal code|crpc|cpc|punishment|sentence|offence|offense|procedure|fir|bail|appeal|evidence act|limitation)\b|\b\d{2,3}[a-z]?\b|(?:\u062F\u0641\u0639\u06C1|\u0642\u0627\u0646\u0648\u0646|\u0633\u0632\u0627|\u0639\u062F\u0627\u0644\u062A|\u0633\u0632\u0627\u06CC\u0627\u062A|\u0646\u0641\u0642\u06C1)/

  const legalDomainPattern =
    /\b(pakistan|pakistani|law|legal|court|divorce|khula|custody|maintenance|tax law|labou?r law|property law|contract law|criminal law|family law)\b/

  const hasLegalSignal = legalStatutePattern.test(normalized) || legalDomainPattern.test(normalized)
  if (!hasLegalSignal) return false

  return !isClearPlatformAccountIntent(query)
}

/** WiseCase account / lawyer search / FAQ — platform tools path. */
export function isClearPlatformAccountIntent(query: string): boolean {
  const normalized = query.toLowerCase().replace(/\s+/g, " ").trim()

  if (
    /\b(profile complete|is my profile|what'?s missing|fill my profile|complete my profile|profile completion|missing field|missing fields)\b/.test(
      normalized,
    )
  ) {
    return true
  }

  if (
    /\b(my phone is|my bio is|my experience is|my fee is|update my|my bio to|my phone to)\b/.test(normalized) ||
    /\b03\d{9}\b/.test(normalized) ||
    /\b\+92[\d\s-]{9,}\b/.test(normalized)
  ) {
    return true
  }

  if (
    /\b(show my cases|my appointments|recent cases|upcoming appointments|my cases|my case|recent activity|agenda|dashboard)\b/.test(
      normalized,
    )
  ) {
    return true
  }

  if (/\b(find|search|browse|recommend|look for|hire|book)\b.*\b(lawyer|lawyers|advocate|advocates)\b/.test(normalized)) {
    return true
  }

  if (/\b(wisecase fees|platform fee|refund|refunds|verification|privacy policy)\b/.test(normalized)) {
    return true
  }

  if (/\b(check|show|complete|update|edit|change)\b.*\b(my )?profile\b/.test(normalized)) {
    return true
  }

  if (
    /\b(review|reviews|rating|ratings)\b.*\b(lawyer|lawyers)\b/.test(normalized) ||
    /\b(lawyer|lawyers)\b.*\b(review|reviews|rating|ratings)\b/.test(normalized)
  ) {
    return true
  }

  return false
}

export function getLoadingPhraseCategory(userMessage: string): LoadingPhraseCategory {
  const normalized = userMessage.toLowerCase().replace(/\s+/g, " ").trim()

  if (
    /\b(profile|bio|phone|experience|fee|update my|complete my profile|missing field|missing fields|my phone is|my bio is)\b/.test(
      normalized,
    ) ||
    /\b03\d{9}\b/.test(normalized)
  ) {
    return "profile"
  }

  if (/\b(find|search|browse|recommend|lawyer|lawyers|advocate|advocates|match)\b/.test(normalized)) {
    return "lawyerSearch"
  }

  if (/\b(my cases|my appointments|recent cases|upcoming appointments|agenda|dashboard|recent activity)\b/.test(normalized)) {
    return "accountSummary"
  }

  if (
    /\b(section|act|ordinance|punishment|statute|ppc|penal code|law|legal|court|fir|bail|appeal|crime|offence|offense)\b/.test(
      normalized,
    ) ||
    /(?:\u062F\u0641\u0639\u06C1|\u0642\u0627\u0646\u0648\u0646|\u0639\u062F\u0627\u0644\u062A|\u0646\u0641\u0642\u06C1)/.test(userMessage)
  ) {
    return "legal"
  }

  if (isClearPlatformAccountIntent(userMessage)) {
    if (/\b(lawyer|lawyers)\b/.test(normalized)) return "lawyerSearch"
    if (/\b(case|appointment)\b/.test(normalized)) return "accountSummary"
    return "profile"
  }

  return "default"
}

export function getLoadingPhrases(category: LoadingPhraseCategory): [string, string, string] {
  switch (category) {
    case "profile":
      return [
        "Analyzing your request...",
        "Fetching your profile data...",
        "Updating your profile...",
      ]
    case "lawyerSearch":
      return [
        "Searching verified lawyers...",
        "Matching by specialization...",
        "Preparing recommendations...",
      ]
    case "accountSummary":
      return [
        "Fetching your account data...",
        "Loading recent activity...",
        "Preparing your summary...",
      ]
    case "legal":
      return [
        "Searching legal knowledge base...",
        "Retrieving relevant sections...",
        "Generating cited response...",
      ]
    default:
      return ["Processing your request...", "Thinking...", "Almost there..."]
  }
}
