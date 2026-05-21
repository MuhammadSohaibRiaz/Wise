"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { consumeAuthHash } from "@/lib/auth/callback-storage"
import {
  establishSessionFromAuthUrl,
  isPasswordRecoveryLink,
} from "@/lib/auth/establish-session-from-url"
import { sanitizeAuthCallbackNext } from "@/lib/auth/redirect-urls"
import { Loader2 } from "lucide-react"

function signInPathForUserType(userType: string | undefined): string {
  const base = userType === "lawyer" ? "/auth/lawyer/sign-in" : "/auth/client/sign-in"
  return `${base}?message=email-confirmed`
}

function signInPathForAuthError(userType: string | undefined, errorCode: string | null): string {
  const base = userType === "lawyer" ? "/auth/lawyer/sign-in" : "/auth/client/sign-in"
  if (errorCode === "otp_expired") {
    return `${base}?error=link-expired`
  }
  return `${base}?error=auth-callback`
}

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [isRecoveryFlow, setIsRecoveryFlow] = useState(false)
  const handledRef = useRef(false)

  useEffect(() => {
    if (handledRef.current) return
    let cancelled = false

    async function run() {
      const supabase = createClient()
      const safeNext = sanitizeAuthCallbackNext(searchParams.get("next"))
      if (isPasswordRecoveryLink(searchParams.get("type"), safeNext)) {
        if (!cancelled) setIsRecoveryFlow(true)
      }

      let hashRaw = window.location.hash
      if (hashRaw) {
        consumeAuthHash()
      } else {
        hashRaw = consumeAuthHash() || ""
      }

      const sessionResult = await establishSessionFromAuthUrl(supabase, {
        searchParams,
        hashFromWindow: hashRaw,
      })

      if (!sessionResult.ok) {
        handledRef.current = true
        if (!cancelled) setError(sessionResult.error)
        window.history.replaceState(null, "", window.location.pathname + window.location.search)
        const dest = isPasswordRecoveryLink(null, safeNext)
          ? "/auth/forgot-password?error=link-expired"
          : signInPathForAuthError(undefined, sessionResult.errorCode)
        setTimeout(() => {
          if (!cancelled) router.replace(dest)
        }, 2500)
        return
      }

      const linkType = sessionResult.linkType
      if (cancelled || !sessionResult.sessionEstablished) return
      handledRef.current = true

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        if (!cancelled) setError("Could not complete authentication. Please try again.")
        return
      }

      const userType = user.user_metadata?.user_type as string | undefined

      const isRecovery = isPasswordRecoveryLink(linkType, safeNext)
      const isEmailVerificationLink =
        !isRecovery &&
        (linkType === "magiclink" ||
          linkType === "signup" ||
          linkType === "email" ||
          linkType === "invite")

      if (isRecovery) {
        router.replace("/auth/reset-password")
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("email_verified_at")
        .eq("id", user.id)
        .maybeSingle()

      if (!profile?.email_verified_at) {
        const markRes = await fetch("/api/auth/mark-email-verified", { method: "POST" })
        if (!markRes.ok) {
          console.error("[Auth callback] mark-email-verified failed:", markRes.status)
          if (!cancelled) {
            setError("Could not save verification status. Please try again or contact support.")
          }
          return
        }
      }

      await supabase.auth.signOut()

      if (cancelled) return

      const dest =
        safeNext === "/auth/lawyer/sign-in" || safeNext === "/auth/client/sign-in"
          ? `${safeNext}?message=email-confirmed`
          : signInPathForUserType(userType)

      router.replace(dest)
    }

    run()
    return () => {
      cancelled = true
    }
  }, [router, searchParams])

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-3 px-4">
      {error ? (
        <>
          <p className="text-sm text-destructive text-center max-w-sm">{error}</p>
          <button
            type="button"
            className="text-sm text-primary underline"
            onClick={() => router.replace("/auth/client/sign-in")}
          >
            Back to sign in
          </button>
        </>
      ) : (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            {isRecoveryFlow ? "Preparing password reset…" : "Verifying your email…"}
          </p>
        </>
      )}
    </main>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  )
}
