import { appointmentStatusLabel } from "@/lib/appointments-status"

/**
 * Human-readable appointment line when DB row can still look odd vs case lifecycle.
 * Prefer schema fixes (scripts 041/042); this smooths remaining edge cases in the UI.
 */
export function appointmentDisplayLabel(
  row: { status: string; scheduled_at: string },
  caseStatus: string,
): { label: string; hint?: string } {
  const end = new Date(row.scheduled_at).getTime()
  const now = Date.now()
  const caseClosed = caseStatus === "completed" || caseStatus === "closed"

  if (row.status === "attended") {
    return {
      label: appointmentStatusLabel("attended"),
      hint: "Consultation session recorded; case may still be in progress until formally closed.",
    }
  }

  if (row.status === "completed" && caseClosed) {
    return {
      label: appointmentStatusLabel("completed"),
      hint: "Appointment closed together with the case.",
    }
  }

  // Legacy / bad row: appointment still "completed" while case is active
  if (row.status === "completed" && !caseClosed) {
    if (end > now) {
      return {
        label: "Upcoming",
        hint: "Run scripts/042 (and 041) in Supabase to normalize statuses.",
      }
    }
    return {
      label: appointmentStatusLabel("attended"),
      hint: "Treated as consultation completed while case is still open — migrate DB with script 042.",
    }
  }

  if ((row.status === "scheduled" || row.status === "pending" || row.status === "awaiting_payment") && end <= now && !caseClosed) {
    return {
      label:
        row.status === "awaiting_payment"
          ? "Awaiting payment"
          : row.status === "scheduled"
            ? "Scheduled (past start)"
            : "Pending (past start)",
      hint: "Start time has passed; confirm attendance or reschedule if needed.",
    }
  }

  return { label: appointmentStatusLabel(row.status) }
}
