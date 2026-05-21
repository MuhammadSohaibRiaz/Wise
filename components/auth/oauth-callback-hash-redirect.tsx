"use client"

import { useEffect } from "react"
import { parseHashParams, stashAuthHash } from "@/lib/auth/callback-storage"
import { getUserTypeFromAccessTokenHash } from "@/lib/auth/parse-auth-hash"
import { getEmailVerificationRedirectUrl } from "@/lib/auth/redirect-urls"

const SIGN_IN_PATHS = ["/auth/client/sign-in", "/auth/lawyer/sign-in"]

/**
 * When Supabase lands on Site URL root (or wrong path) with auth tokens,
 * forward to the correct role sign-in page — not /auth/callback.
 */
export function OAuthCallbackHashRedirect() {
  useEffect(() => {
    if (typeof window === "undefined") return

    const pathname = window.location.pathname
    if (pathname === "/auth/callback" || SIGN_IN_PATHS.includes(pathname)) return

    const search = window.location.search
    const hash = window.location.hash
    const params = new URLSearchParams(search)
    const code = params.get("code")

    if (!hash && !code) return

    if (hash) {
      stashAuthHash(hash)
      const hashParams = parseHashParams(hash)
      if (hashParams.get("error") || hashParams.get("error_code")) {
        const userType = getUserTypeFromAccessTokenHash(hash) ?? "client"
        window.location.replace(getEmailVerificationRedirectUrl(userType))
        return
      }
      if (hash.includes("access_token")) {
        const userType = getUserTypeFromAccessTokenHash(hash) ?? "client"
        window.location.replace(getEmailVerificationRedirectUrl(userType))
        return
      }
    }

    if (code) {
      stashAuthHash(hash)
      const target = new URL("/auth/callback", window.location.origin)
      params.forEach((value, key) => target.searchParams.set(key, value))
      window.location.replace(target.toString())
    }
  }, [])

  return null
}
