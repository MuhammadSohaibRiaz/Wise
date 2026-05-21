"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { consumeAuthHash, parseHashParams } from "@/lib/auth/callback-storage"
import type { AuthUserType } from "@/lib/auth/redirect-urls"

type VerificationResult =
  | { status: "idle" }
  | { status: "verifying" }
  | { status: "verified" }
  | { status: "error"; message: string }
  | { status: "link-expired" }

/**
 * Completes email verification when Supabase redirects to the sign-in page
 * with #access_token=... or ?code=... (no /auth/callback intermediate screen).
 */
export function useEmailVerificationUrl(expectedUserType: AuthUserType) {
  const [result, setResult] = useState<VerificationResult>({ status: "idle" })
  const handledRef = useRef(false)

  useEffect(() => {
    if (handledRef.current || typeof window === "undefined") return

    async function run() {
      let hashRaw = window.location.hash
      if (hashRaw) {
        consumeAuthHash()
      } else {
        hashRaw = consumeAuthHash() || ""
      }

      const searchParams = new URLSearchParams(window.location.search)
      const code = searchParams.get("code")

      if (!hashRaw && !code) return

      if (hashRaw) {
        const hashParams = parseHashParams(hashRaw)
        if (hashParams.get("error") || hashParams.get("error_code")) {
          handledRef.current = true
          const isExpired = hashParams.get("error_code") === "otp_expired"
          setResult(
            isExpired
              ? { status: "link-expired" }
              : {
                  status: "error",
                  message:
                    hashParams.get("error_description")?.replace(/\+/g, " ") ??
                    "Verification link is invalid.",
                },
          )
          window.history.replaceState(null, "", window.location.pathname)
          return
        }
      }

      handledRef.current = true
      setResult({ status: "verifying" })

      const supabase = createClient()
      let linkType: string | null = null

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
        } else if (hashRaw) {
          const hashParams = parseHashParams(hashRaw)
          linkType = hashParams.get("type")
          const access_token = hashParams.get("access_token")
          const refresh_token = hashParams.get("refresh_token")
          if (!access_token || !refresh_token) {
            throw new Error("Invalid verification link.")
          }
          const { error } = await supabase.auth.setSession({ access_token, refresh_token })
          if (error) throw error
        }

        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) throw new Error("Could not verify your account.")

        const actualType = (user.user_metadata?.user_type as string | undefined) ?? "client"
        if (actualType !== expectedUserType) {
          await supabase.auth.signOut()
          throw new Error(
            actualType === "lawyer"
              ? "This is a lawyer account. Open the lawyer sign-in page from your email link."
              : "This is a client account. Open the client sign-in page from your email link.",
          )
        }

        const isEmailVerificationLink =
          linkType === "magiclink" ||
          linkType === "signup" ||
          linkType === "email" ||
          linkType === "invite" ||
          !linkType

        if (!isEmailVerificationLink && linkType === "recovery") {
          window.history.replaceState(null, "", window.location.pathname)
          window.location.replace("/auth/reset-password")
          return
        }

        const markRes = await fetch("/api/auth/mark-email-verified", { method: "POST" })
        if (!markRes.ok) throw new Error("Could not save verification. Please try again.")

        await supabase.auth.signOut()
        window.history.replaceState(null, "", window.location.pathname)
        setResult({ status: "verified" })
      } catch (err) {
        const message = err instanceof Error ? err.message : "Verification failed."
        setResult({ status: "error", message })
        window.history.replaceState(null, "", window.location.pathname)
        await createClient().auth.signOut()
      }
    }

    void run()
  }, [expectedUserType])

  return result
}
