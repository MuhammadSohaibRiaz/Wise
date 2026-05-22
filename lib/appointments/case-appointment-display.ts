type CaseAppointmentLike = {
  scheduled_at: string
  status: string
}

const ACTIVE_APPOINTMENT_STATUSES = new Set([
  "pending",
  "awaiting_payment",
  "scheduled",
  "rescheduled",
  "cancellation_requested",
])

const HELD_APPOINTMENT_STATUSES = new Set(["attended", "completed"])

function byScheduledAtAsc(a: CaseAppointmentLike, b: CaseAppointmentLike) {
  return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
}

function byScheduledAtDesc(a: CaseAppointmentLike, b: CaseAppointmentLike) {
  return new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()
}

export function getPrimaryCaseAppointment<T extends CaseAppointmentLike>(appointments: T[]): T | null {
  const now = Date.now()
  const active = appointments.filter((appointment) =>
    ACTIVE_APPOINTMENT_STATUSES.has(appointment.status),
  )

  const nextActive = active
    .filter((appointment) => new Date(appointment.scheduled_at).getTime() >= now)
    .sort(byScheduledAtAsc)[0]
  if (nextActive) return nextActive

  const latestActive = active.sort(byScheduledAtDesc)[0]
  if (latestActive) return latestActive

  const latestHeld = appointments
    .filter((appointment) => HELD_APPOINTMENT_STATUSES.has(appointment.status))
    .sort(byScheduledAtDesc)[0]
  return latestHeld ?? null
}

export function formatCaseAppointmentDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}
