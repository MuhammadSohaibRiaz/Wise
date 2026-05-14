import type { SupabaseClient } from "@supabase/supabase-js"

/** Stable codes for UI / filtering — append-only. */
export const CaseTimelineEventType = {
  CASE_CREATED: "CASE_CREATED",
  DOCUMENT_UPLOADED: "DOCUMENT_UPLOADED",
  AI_ANALYSIS_COMPLETED: "AI_ANALYSIS_COMPLETED",
  LAWYER_SELECTED: "LAWYER_SELECTED",
  CONSULTATION_REQUESTED: "CONSULTATION_REQUESTED",
  CONSULTATION_ACCEPTED: "CONSULTATION_ACCEPTED",
  PAYMENT_COMPLETED: "PAYMENT_COMPLETED",
  CASE_ACTIVATED: "CASE_ACTIVATED",
  DISPUTE_OPENED: "DISPUTE_OPENED",
  CASE_COMPLETED: "CASE_COMPLETED",
  APPOINTMENT_CANCELLED: "APPOINTMENT_CANCELLED",
  CONSULTATION_ATTENDED: "CONSULTATION_ATTENDED",
  LAWYER_REJECTED_CONSULTATION: "LAWYER_REJECTED_CONSULTATION",
  LAWYER_CANCELLED_CONSULTATION: "LAWYER_CANCELLED_CONSULTATION",
  CONSULTATION_RESCHEDULED: "CONSULTATION_RESCHEDULED",
  CANCELLATION_REQUESTED: "CANCELLATION_REQUESTED",
  CANCELLATION_RESOLVED: "CANCELLATION_RESOLVED",
} as const

export type CaseTimelineEventTypeKey = (typeof CaseTimelineEventType)[keyof typeof CaseTimelineEventType]

const TIMELINE_LABELS: Record<string, string> = {
  [CaseTimelineEventType.CASE_CREATED]: "Case created",
  [CaseTimelineEventType.DOCUMENT_UPLOADED]: "Document uploaded",
  [CaseTimelineEventType.AI_ANALYSIS_COMPLETED]: "AI analysis completed",
  [CaseTimelineEventType.LAWYER_SELECTED]: "Lawyer selected",
  [CaseTimelineEventType.CONSULTATION_REQUESTED]: "Consultation requested",
  [CaseTimelineEventType.CONSULTATION_ACCEPTED]: "Consultation accepted",
  [CaseTimelineEventType.PAYMENT_COMPLETED]: "Payment completed",
  [CaseTimelineEventType.CASE_ACTIVATED]: "Case activated",
  [CaseTimelineEventType.DISPUTE_OPENED]: "Dispute opened",
  [CaseTimelineEventType.CASE_COMPLETED]: "Case completed",
  [CaseTimelineEventType.APPOINTMENT_CANCELLED]: "Appointment cancelled",
  [CaseTimelineEventType.CONSULTATION_ATTENDED]: "Consultation held",
  [CaseTimelineEventType.LAWYER_REJECTED_CONSULTATION]: "Consultation rejected by lawyer",
  [CaseTimelineEventType.LAWYER_CANCELLED_CONSULTATION]: "Consultation cancelled by lawyer",
  [CaseTimelineEventType.CONSULTATION_RESCHEDULED]: "Consultation rescheduled",
  [CaseTimelineEventType.CANCELLATION_REQUESTED]: "Cancellation requested",
  [CaseTimelineEventType.CANCELLATION_RESOLVED]: "Cancellation resolved",
}

/** Human-readable title for a timeline row (stable across GPT-style lifecycle wording). */
export function formatCaseTimelineEventLabel(eventType: string): string {
  return TIMELINE_LABELS[eventType] ?? eventType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export function caseTimelineEventDetail(
  eventType: string,
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  const m = metadata ?? {}
  if (eventType === CaseTimelineEventType.CONSULTATION_REQUESTED && typeof m.scheduled_at === "string") {
    try {
      return new Date(m.scheduled_at).toLocaleString()
    } catch {
      return null
    }
  }
  if (eventType === CaseTimelineEventType.APPOINTMENT_CANCELLED && typeof m.appointment_id === "string") {
    return "Client cancelled the booking"
  }
  if (eventType === CaseTimelineEventType.CONSULTATION_ACCEPTED && typeof m.appointment_id === "string") {
    return "Lawyer accepted the consultation request"
  }
  if (eventType === CaseTimelineEventType.CONSULTATION_ATTENDED && typeof m.appointment_id === "string") {
    return "Consultation recorded as held (separate from closing the case)"
  }
  if (eventType === CaseTimelineEventType.LAWYER_REJECTED_CONSULTATION && typeof m.appointment_id === "string") {
    return "Lawyer declined this consultation request"
  }
  if (eventType === CaseTimelineEventType.LAWYER_CANCELLED_CONSULTATION && typeof m.appointment_id === "string") {
    return "Lawyer cancelled a previously accepted consultation"
  }
  if (eventType === CaseTimelineEventType.CONSULTATION_RESCHEDULED && typeof m.appointment_id === "string") {
    return "Consultation timing was updated"
  }
  if (eventType === CaseTimelineEventType.CANCELLATION_REQUESTED && typeof m.appointment_id === "string") {
    return "A cancellation request was submitted for admin review"
  }
  if (eventType === CaseTimelineEventType.CANCELLATION_RESOLVED && typeof m.resolution === "string") {
    return m.resolution === "approved"
      ? "Cancellation request was approved by admin"
      : `Cancellation request was rejected by admin${typeof m.reason === "string" && m.reason ? ` — ${m.reason}` : ""}`
  }
  return null
}

export async function appendCaseTimelineEvent(
  supabase: SupabaseClient,
  params: {
    caseId: string
    actorId: string | null
    eventType: string
    metadata?: Record<string, unknown>
  },
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("case_timeline_events").insert({
    case_id: params.caseId,
    actor_id: params.actorId,
    event_type: params.eventType,
    metadata: params.metadata ?? {},
  })
  if (error) {
    console.warn("[case-timeline] insert skipped:", error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}
