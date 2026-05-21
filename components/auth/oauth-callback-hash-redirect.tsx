"use client"

import { useEffect } from "react"
import { parseHashParams, stashAuthHash } from "@/lib/auth/callback-storage"

/**
 * Supabase redirects to Site URL root with hash or query params.
 * Stash the hash and send users to /auth/callback (hash often lost on navigation).
 */
export function OAuthCallbackHashRedirect() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.location.pathname === "/auth/callback") return

    const search = window.location.search
    const hash = window.location.hash
    const params = new URLSearchParams(search)
    const code = params.get("code")

    if (hash) {
      const hashParams = parseHashParams(hash)
      if (hashParams.get("error") || hashParams.get("error_code")) {
        stashAuthHash(hash)
        window.location.replace("/auth/callback")
        return
      }
      if (hash.includes("access_token")) {
        stashAuthHash(hash)
        const target = new URL("/auth/callback", window.location.origin)
        params.forEach((value, key) => target.searchParams.set(key, value))
        window.location.replace(target.toString())
        return
      }
    }

    if (code) {
      const target = new URL("/auth/callback", window.location.origin)
      params.forEach((value, key) => target.searchParams.set(key, value))
      if (hash) stashAuthHash(hash)
      window.location.replace(target.toString())
    }
  }, [])

  return null
}
