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

/** Email verification links land directly on the role sign-in page (no /auth/callback hop). */
export function getEmailVerificationRedirectUrl(userType: AuthUserType): string {
  const path = userType === "lawyer" ? "/auth/lawyer/sign-in" : "/auth/client/sign-in"
  return `${getSiteOriginForAuth()}${path}`
}
