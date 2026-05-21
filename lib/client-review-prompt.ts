const REVIEW_SKIP_PREFIX = "wisecase-review-skipped:"

export function reviewSkipStorageKey(caseId: string): string {
  return `${REVIEW_SKIP_PREFIX}${caseId}`
}

/** Client chose not to review now; do not auto-prompt again for this case. */
export function markReviewPromptSkipped(caseId: string): void {
  if (typeof window === "undefined" || !caseId) return
  try {
    window.localStorage.setItem(reviewSkipStorageKey(caseId), "true")
  } catch {
    // ignore quota / private mode
  }
}

export function isReviewPromptSkipped(caseId: string): boolean {
  if (typeof window === "undefined" || !caseId) return false
  try {
    return window.localStorage.getItem(reviewSkipStorageKey(caseId)) === "true"
  } catch {
    return false
  }
}

/** Whether the app should auto-open a review dialog for this case. */
export function shouldAutoPromptReview(caseId: string, hasReviewInDb: boolean): boolean {
  if (!caseId || hasReviewInDb) return false
  return !isReviewPromptSkipped(caseId)
}
