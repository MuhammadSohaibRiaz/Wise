/** Button label for reschedule; null when max reschedules reached. */
export function formatRescheduleButtonLabel(rescheduleCount: number): string | null {
  if (rescheduleCount >= 3) return null
  if (rescheduleCount <= 0) return "Reschedule"
  const left = 3 - rescheduleCount
  return `Reschedule (${left} left)`
}

/** Reschedule modal hint — remaining count only after first reschedule. */
export function formatRescheduleModalHint(rescheduleCount: number): string {
  if (rescheduleCount <= 0) return ""
  const left = 3 - rescheduleCount
  return ` (${left} reschedule${left === 1 ? "" : "s"} remaining)`
}

export const MAX_RESCHEDULES_MESSAGE =
  "Maximum reschedules reached. Please attend or contact support to cancel."
  