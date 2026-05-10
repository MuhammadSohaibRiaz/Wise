/**
 * Single place for appointment status semantics (see scripts/042_appointments_attended_status.sql).
 *
 * - `scheduled` — upcoming / confirmed slot (not yet held).
 * - `attended` — consultation session occurred (billable / “session done”).
 * - `completed` — row closed with the **case** (usually set by DB trigger when case → completed).
 */

export const APPOINTMENT_ACTIVE_SLOT_STATUSES = [
  "pending",
  "awaiting_payment",
  "scheduled",
  "rescheduled",
] as const

/** Statuses that block the same calendar slot as a booked consultation. */
export const APPOINTMENT_SLOT_BLOCKING_STATUSES = [
  ...APPOINTMENT_ACTIVE_SLOT_STATUSES,
  "attended",
  "completed",
] as const

/** Minutes that count toward billed time (session held or administratively closed with case). */
export function isAppointmentBillable(status: string | null | undefined): boolean {
  return status === "attended" || status === "completed"
}

export function appointmentStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "awaiting_payment":
      return "Awaiting payment"
    case "pending":
      return "Pending"
    case "scheduled":
      return "Scheduled"
    case "rescheduled":
      return "Rescheduled"
    case "attended":
      return "Consultation completed"
    case "completed":
      return "Closed with case"
    case "cancelled":
      return "Cancelled"
    case "rejected":
      return "Rejected"
    default:
      return status ? status.replace(/_/g, " ") : "—"
  }
}
