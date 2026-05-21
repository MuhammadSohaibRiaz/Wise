/** Shared auth redirect URLs (safe for client and server). */

export type AuthUserType = "client" | "lawyer"

export function getSiteOriginForAuth(): string {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")
  }
  if (typeof window !== "undefined") {
    return window.location.origin
  }
  return "http://localhost:3000"
}

/** Password reset / PKCE flows that still use the shared callback handler. */
export function getAuthCallbackUrl(next?: string): string {
  const url = new URL("/auth/callback", getSiteOriginForAuth())
  if (next) url.searchParams.set("next", next)
  return url.toString()
}

/** Supabase resetPasswordForEmail redirect — must be allow-listed in Supabase Auth URLs. */
export function getPasswordResetCallbackUrl(): string {
  return getAuthCallbackUrl("/auth/reset-password")
}

/**
 * Paths allowed in ?next= on /auth/callback (blocks open redirects).
 * Add new auth destinations here and in Supabase redirect allow list.
 */
export const AUTH_CALLBACK_NEXT_PATHS = [
  "/auth/reset-password",
  "/auth/client/sign-in",
  "/auth/lawyer/sign-in",
] as const

export function sanitizeAuthCallbackNext(requested: string | null): string | null {
  if (!requested) return null
  return (AUTH_CALLBACK_NEXT_PATHS as readonly string[]).includes(requested) ? requested : null
}

/** Email verification links land directly on the role sign-in page (no /auth/callback hop). */
export function getEmailVerificationRedirectUrl(userType: AuthUserType): string {
  const path = userType === "lawyer" ? "/auth/lawyer/sign-in" : "/auth/client/sign-in"
  return `${getSiteOriginForAuth()}${path}`
}
