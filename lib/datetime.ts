/** WiseCase operates in Pakistan — use one timezone for all user-facing appointment times. */
export const APP_TIMEZONE = "Asia/Karachi"

const DEFAULT_APPOINTMENT_FORMAT: Intl.DateTimeFormatOptions = {
  timeZone: APP_TIMEZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
}

/**
 * Format an ISO timestamp for notifications, emails, and admin views (always PKT).
 */
export function formatAppointmentDateTime(
  iso: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!iso) return ""
  const d = typeof iso === "string" ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleString("en-PK", { ...DEFAULT_APPOINTMENT_FORMAT, ...options })
}

/** Date only in Pakistan, e.g. "Thu, 21 May 2026". */
export function formatAppointmentDate(iso: string | Date | null | undefined): string {
  if (!iso) return ""
  const d = typeof iso === "string" ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleString("en-PK", {
    timeZone: APP_TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

/** Time only, e.g. "3:00 PM" in Pakistan. */
export function formatAppointmentTime(iso: string | Date | null | undefined): string {
  if (!iso) return ""
  const d = typeof iso === "string" ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleString("en-PK", {
    timeZone: APP_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}
