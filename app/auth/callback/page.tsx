"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { consumeAuthHash, parseHashParams } from "@/lib/auth/callback-storage"
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
  const handledRef = useRef(false)

  useEffect(() => {
    if (handledRef.current) return
    let cancelled = false

    async function run() {
      const supabase = createClient()
      const requestedNext = searchParams.get("next")
      const linkTypeParam = searchParams.get("type")
      const safeNext =
        requestedNext === "/auth/reset-password" ||
        requestedNext === "/auth/client/sign-in" ||
        requestedNext === "/auth/lawyer/sign-in"
          ? requestedNext
          : null

      let hashRaw = window.location.hash
      if (hashRaw) {
        consumeAuthHash()
      } else {
        hashRaw = consumeAuthHash() || ""
      }

      if (hashRaw) {
        const hashParams = parseHashParams(hashRaw)
        if (hashParams.get("error") || hashParams.get("error_code")) {
          handledRef.current = true
          const errorCode = hashParams.get("error_code")
          const desc = hashParams.get("error_description")?.replace(/\+/g, " ") ?? "Link invalid or expired."
          if (!cancelled) {
            setError(desc)
          }
          window.history.replaceState(null, "", window.location.pathname + window.location.search)
          setTimeout(() => {
            if (!cancelled) router.replace(signInPathForAuthError(undefined, errorCode))
          }, 2500)
          return
        }
      }

      const code = searchParams.get("code")
      let linkType: string | null = linkTypeParam
      let sessionEstablished = false

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeError) {
          if (!cancelled) setError(exchangeError.message)
          return
        }
        sessionEstablished = true
      } else if (hashRaw) {
        const hashParams = parseHashParams(hashRaw)
        linkType = linkType ?? hashParams.get("type")
        const access_token = hashParams.get("access_token")
        const refresh_token = hashParams.get("refresh_token")

        if (!access_token || !refresh_token) {
          if (!cancelled) setError("Invalid or expired link.")
          return
        }

        const { error: sessionError } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        })
        if (sessionError) {
          if (!cancelled) setError(sessionError.message)
          return
        }
        sessionEstablished = true
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`)
      } else {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (session) {
          sessionEstablished = true
        } else {
          if (!cancelled) setError("Invalid or expired link.")
          return
        }
      }

      if (cancelled || !sessionEstablished) return
      handledRef.current = true

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        if (!cancelled) setError("Could not complete authentication. Please try again.")
        return
      }

      const userType = user.user_metadata?.user_type as string | undefined

      const isEmailVerificationLink =
        linkType === "magiclink" || linkType === "signup" || linkType === "email" || linkType === "invite"
      const isRecovery =
        !isEmailVerificationLink &&
        (safeNext === "/auth/reset-password" || linkType === "recovery")

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
          <p className="text-sm text-muted-foreground">Verifying your email…</p>
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
