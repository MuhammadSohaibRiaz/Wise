export const CASE_DETAIL_CHANGED_EVENT = "wisecase:case-detail-changed"

/** Notify open case detail pages to refetch stepper inputs (case, appointments, timeline). */
export function notifyCaseDetailChanged(caseId: string) {
  if (typeof window === "undefined" || !caseId) return
  window.dispatchEvent(
    new CustomEvent(CASE_DETAIL_CHANGED_EVENT, { detail: { caseId } }),
  )
}
