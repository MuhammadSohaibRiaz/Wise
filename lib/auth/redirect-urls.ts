/** Shared auth redirect URLs (safe for client and server). */

export function getSiteOriginForAuth(): string {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")
  }
  if (typeof window !== "undefined") {
    return window.location.origin
  }
  return "http://localhost:3000"
}

export function getAuthCallbackUrl(next?: string): string {
  const url = new URL("/auth/callback", getSiteOriginForAuth())
  if (next) url.searchParams.set("next", next)
  return url.toString()
}
