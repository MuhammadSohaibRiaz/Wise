/**
 * User-facing copy when Groq / AI provider capacity is exhausted.
 * Keep technical details in server logs only.
 */
export const AI_CAPACITY_USER_MESSAGE =
  "We're experiencing high demand on our servers right now. Document analysis is temporarily unavailable — please try again in a few minutes."

export const AI_CAPACITY_CHAT_MESSAGE =
  "We're experiencing high demand right now. Please wait a few minutes and try again."

const CAPACITY_PATTERN =
  /rate\s*limit|rate_limit|429|tokens per day|daily token|quota exceeded|usage limit|tpd|limit reached|ai service daily limit|temporarily unavailable due to high usage|high demand on our servers/i

export function isAiCapacityLimitError(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error ?? "")
  return CAPACITY_PATTERN.test(text)
}

export function toUserFacingAnalysisError(
  error: unknown,
  fallback = "We couldn't complete the analysis right now. Please try again shortly.",
): string {
  if (isAiCapacityLimitError(error)) return AI_CAPACITY_USER_MESSAGE
  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}

export function getAnalysisErrorToast(error: unknown): { title: string; description: string } {
  if (isAiCapacityLimitError(error)) {
    return { title: "High demand right now", description: AI_CAPACITY_USER_MESSAGE }
  }
  return {
    title: "Analysis unavailable",
    description: error instanceof Error ? error.message : "Please try again in a moment.",
  }
}
