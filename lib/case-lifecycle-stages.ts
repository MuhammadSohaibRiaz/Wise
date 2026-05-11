import { CaseTimelineEventType } from "./case-timeline"

/**
 * Normalized lifecycle stages derived from REAL backend statuses and timeline events.
 * These are UI display concepts only — no new DB columns, no duplicate workflow logic.
 *
 * DB sources:
 *   case.status:        open | in_progress | pending_completion | completed | closed
 *   appointment.status: pending | awaiting_payment | scheduled | rescheduled | attended | completed | cancelled | rejected
 *   case_timeline_events.event_type: CASE_CREATED, CONSULTATION_REQUESTED, PAYMENT_COMPLETED, etc.
 */

export type LifecycleStageKey =
  | "draft"
  | "consultation_requested"
  | "payment"
  | "consultation_scheduled"
  | "consultation_held"
  | "case_in_progress"
  | "pending_completion"
  | "completed"

export interface LifecycleStage {
  key: LifecycleStageKey
  label: string
  shortLabel: string
  status: "done" | "current" | "upcoming"
  nextAction?: string
}

const STAGE_DEFS: { key: LifecycleStageKey; label: string; shortLabel: string }[] = [
  { key: "draft", label: "Case Created", shortLabel: "Created" },
  { key: "consultation_requested", label: "Consultation Requested", shortLabel: "Requested" },
  { key: "payment", label: "Payment Completed", shortLabel: "Paid" },
  { key: "consultation_scheduled", label: "Consultation Scheduled", shortLabel: "Scheduled" },
  { key: "consultation_held", label: "Consultation Held", shortLabel: "Held" },
  { key: "case_in_progress", label: "Case In Progress", shortLabel: "In Progress" },
  { key: "pending_completion", label: "Completion Requested", shortLabel: "Pending" },
  { key: "completed", label: "Case Completed", shortLabel: "Completed" },
]

interface DerivationInput {
  caseStatus: string
  appointments: { status: string }[]
  timelineEventTypes: string[]
}

/**
 * Derives the furthest-reached stage index from real data, then maps
 * every stage to done / current / upcoming.
 */
export function deriveCaseLifecycleStages(input: DerivationInput): LifecycleStage[] {
  const { caseStatus, appointments, timelineEventTypes } = input
  const events = new Set(timelineEventTypes)

  let reachedIndex = 0

  // Stage 0: draft — always reached (case row exists)
  reachedIndex = 0

  // Stage 1: consultation_requested
  const hasConsultationRequested =
    events.has(CaseTimelineEventType.CONSULTATION_REQUESTED) ||
    events.has(CaseTimelineEventType.CONSULTATION_ACCEPTED) ||
    appointments.some((a) =>
      ["pending", "awaiting_payment", "scheduled", "rescheduled", "attended", "completed"].includes(a.status),
    )
  if (hasConsultationRequested) reachedIndex = 1

  // Stage 2: payment
  const hasPayment =
    events.has(CaseTimelineEventType.PAYMENT_COMPLETED) ||
    appointments.some((a) =>
      ["scheduled", "rescheduled", "attended", "completed"].includes(a.status),
    )
  if (hasPayment) reachedIndex = 2

  // Stage 3: consultation_scheduled
  const hasScheduled = appointments.some((a) =>
    ["scheduled", "rescheduled", "attended", "completed"].includes(a.status),
  )
  if (hasScheduled) reachedIndex = 3

  // Stage 4: consultation_held
  const hasAttended =
    events.has(CaseTimelineEventType.CONSULTATION_ATTENDED) ||
    appointments.some((a) => a.status === "attended" || a.status === "completed")
  if (hasAttended) reachedIndex = 4

  // Stage 5: case_in_progress
  if (
    ["in_progress", "pending_completion", "completed", "closed"].includes(caseStatus) &&
    hasAttended
  ) {
    reachedIndex = 5
  }

  // Stage 6: pending_completion
  if (["pending_completion", "completed", "closed"].includes(caseStatus)) {
    reachedIndex = 6
  }

  // Stage 7: completed
  if (caseStatus === "completed" || caseStatus === "closed") {
    reachedIndex = 7
  }

  return STAGE_DEFS.map((def, idx) => {
    let status: LifecycleStage["status"]
    let nextAction: string | undefined

    if (idx < reachedIndex) {
      status = "done"
    } else if (idx === reachedIndex) {
      status = "current"
      nextAction = getNextAction(def.key, input)
    } else {
      status = "upcoming"
    }

    return { ...def, status, nextAction }
  })
}

function getNextAction(currentStageKey: LifecycleStageKey, input: DerivationInput): string | undefined {
  switch (currentStageKey) {
    case "draft":
      return "Find a lawyer and request a consultation"
    case "consultation_requested": {
      const hasPending = input.appointments.some((a) => a.status === "pending")
      const hasAwaiting = input.appointments.some((a) => a.status === "awaiting_payment")
      if (hasPending) return "Waiting for lawyer to accept the request"
      if (hasAwaiting) return "Complete payment to confirm booking"
      return "Awaiting confirmation"
    }
    case "payment":
      return "Payment done — consultation will be scheduled"
    case "consultation_scheduled":
      return "Attend the consultation, then mark it as held"
    case "consultation_held":
      return "Case work continues — lawyer will request completion when done"
    case "case_in_progress":
      return "Lawyer will request case completion when work is finished"
    case "pending_completion":
      return "Client to confirm completion and leave a review"
    case "completed":
      return undefined
    default:
      return undefined
  }
}

/** Icon name mapping for each stage (lucide icon names). */
export function stageIconName(key: LifecycleStageKey): string {
  switch (key) {
    case "draft": return "file-text"
    case "consultation_requested": return "send"
    case "payment": return "credit-card"
    case "consultation_scheduled": return "calendar"
    case "consultation_held": return "check-circle-2"
    case "case_in_progress": return "briefcase"
    case "pending_completion": return "clock"
    case "completed": return "trophy"
    default: return "circle"
  }
}
