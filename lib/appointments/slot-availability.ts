import { APP_TIMEZONE } from "@/lib/datetime"
import { APPOINTMENT_SLOT_BLOCKING_STATUSES } from "@/lib/appointments-status"

/** Calendar day key in local timezone (YYYY-MM-DD). */
export function toLocalDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export type BookedAppointmentSlot = {
  scheduled_at: string
  duration_minutes?: number | null
}

export type SlotAvailabilityOptions = {
  date: Date
  durationMinutes: number
  booked: BookedAppointmentSlot[]
  startHour?: number
  endHour?: number
  stepMinutes?: number
  now?: Date
}

export function slotsOverlap(
  slotStart: Date,
  slotEnd: Date,
  aptStart: Date,
  aptEnd: Date,
): boolean {
  return !(slotEnd <= aptStart || slotStart >= aptEnd)
}

/** Minute-level slot key in app timezone (e.g. 2025-05-24T15:00) for comparing picks to stored times. */
export function getAppointmentSlotMinuteKey(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return ""
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: APP_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

/** True when the candidate start is the same calendar slot as the appointment's current time (PKT). */
export function isSameAppointmentSlot(candidateStart: Date, currentScheduledAt: string): boolean {
  const a = getAppointmentSlotMinuteKey(candidateStart)
  const b = getAppointmentSlotMinuteKey(currentScheduledAt)
  return Boolean(a && b && a === b)
}

/** Treat the appointment's current time as booked so reschedule UIs do not offer a no-op slot. */
export function bookedSlotsIncludingCurrent(
  booked: BookedAppointmentSlot[],
  currentScheduledAt: string,
  durationMinutes: number,
): BookedAppointmentSlot[] {
  if (!currentScheduledAt) return booked
  return [...booked, { scheduled_at: currentScheduledAt, duration_minutes: durationMinutes }]
}

export function buildSlotTimes(
  date: Date,
  durationMinutes: number,
  options?: { startHour?: number; endHour?: number; stepMinutes?: number; now?: Date },
): string[] {
  const startHour = options?.startHour ?? 9
  const endHour = options?.endHour ?? 18
  const stepMinutes = options?.stepMinutes ?? 30
  const now = options?.now ?? new Date()
  const isToday = date.toDateString() === now.toDateString()
  const slots: string[] = []

  for (let hour = startHour; hour < endHour; hour++) {
    for (let minute = 0; minute < 60; minute += stepMinutes) {
      const slotTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
      const slotDateTime = new Date(date)
      slotDateTime.setHours(hour, minute, 0, 0)
      const slotEnd = new Date(slotDateTime.getTime() + durationMinutes * 60_000)
      const endOfDay = new Date(date)
      endOfDay.setHours(endHour, 0, 0, 0)

      if (slotEnd > endOfDay) continue
      if (isToday && slotDateTime <= now) continue
      slots.push(slotTime)
    }
  }

  return slots
}

export function filterAvailableSlots(
  slotTimes: string[],
  date: Date,
  durationMinutes: number,
  booked: BookedAppointmentSlot[],
): string[] {
  return slotTimes.filter((slotTime) => {
    const [hours, minutes] = slotTime.split(":").map(Number)
    const slotDateTime = new Date(date)
    slotDateTime.setHours(hours, minutes, 0, 0)
    const slotEnd = new Date(slotDateTime.getTime() + durationMinutes * 60_000)

    const isBooked = booked.some((apt) => {
      const aptStart = new Date(apt.scheduled_at)
      const aptEnd = new Date(aptStart.getTime() + (apt.duration_minutes || 60) * 60_000)
      return slotsOverlap(slotDateTime, slotEnd, aptStart, aptEnd)
    })

    return !isBooked
  })
}

export function getAvailableSlotsForDay(options: SlotAvailabilityOptions): string[] {
  const all = buildSlotTimes(options.date, options.durationMinutes, {
    startHour: options.startHour,
    endHour: options.endHour,
    stepMinutes: options.stepMinutes,
    now: options.now,
  })
  return filterAvailableSlots(all, options.date, options.durationMinutes, options.booked)
}

export function isDayFullyBooked(
  date: Date,
  durationMinutes: number,
  bookedOnDay: BookedAppointmentSlot[],
  options?: { startHour?: number; endHour?: number; now?: Date },
): boolean {
  return (
    getAvailableSlotsForDay({
      date,
      durationMinutes,
      booked: bookedOnDay,
      startHour: options?.startHour,
      endHour: options?.endHour,
      now: options?.now,
    }).length === 0
  )
}

export function getAppointmentSlotEnd(scheduledAt: string, durationMinutes: number): Date {
  const start = new Date(scheduledAt)
  return new Date(start.getTime() + durationMinutes * 60_000)
}

export function canMarkConsultationHeld(
  status: string,
  scheduledAt: string,
  _durationMinutes?: number,
  now = Date.now(),
): boolean {
  if (status !== "scheduled" && status !== "rescheduled") return false
  const start = new Date(scheduledAt).getTime()
  const allowEarlyMs = 7 * 24 * 60 * 60_000
  return now >= start - allowEarlyMs
}

export function canMarkNoShow(
  status: string,
  scheduledAt: string,
  durationMinutes: number,
  now = Date.now(),
): boolean {
  if (status !== "scheduled" && status !== "rescheduled") return false
  return now >= getAppointmentSlotEnd(scheduledAt, durationMinutes || 60).getTime()
}

/** Dates (YYYY-MM-DD) with no free slots in range. */
export function getFullyBookedDateStrings(
  rangeStart: Date,
  rangeEnd: Date,
  durationMinutes: number,
  allBooked: BookedAppointmentSlot[],
  options?: { startHour?: number; endHour?: number; now?: Date },
): Set<string> {
  const blocked = new Set<string>()
  const cursor = new Date(rangeStart)
  cursor.setHours(0, 0, 0, 0)
  const end = new Date(rangeEnd)
  end.setHours(23, 59, 59, 999)

  while (cursor <= end) {
    const dateStr = toLocalDateString(cursor)
    const onDay = allBooked.filter((apt) => {
      return toLocalDateString(new Date(apt.scheduled_at)) === dateStr
    })
    if (isDayFullyBooked(cursor, durationMinutes, onDay, options)) {
      blocked.add(dateStr)
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  return blocked
}

export { APPOINTMENT_SLOT_BLOCKING_STATUSES }
