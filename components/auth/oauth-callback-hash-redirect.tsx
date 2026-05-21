"use client"

import { useEffect } from "react"

/**
 * Supabase often redirects to Site URL root instead of /auth/callback:
 * - PKCE: ?code=...
 * - Implicit/magic-link: #access_token=...
 * Forward both to /auth/callback so the handler can complete the flow.
 */
export function OAuthCallbackHashRedirect() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.location.pathname === "/auth/callback") return

    const search = window.location.search
    const hash = window.location.hash
    const params = new URLSearchParams(search)
    const code = params.get("code")

    if (code) {
      const target = new URL("/auth/callback", window.location.origin)
      params.forEach((value, key) => target.searchParams.set(key, value))
      window.location.replace(target.toString() + hash)
      return
    }

    if (hash && hash.includes("access_token")) {
      window.location.replace(`/auth/callback${search}${hash}`)
    }
  }, [])

  return null
}
