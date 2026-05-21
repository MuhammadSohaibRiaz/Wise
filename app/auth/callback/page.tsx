"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"

function signInPathForUserType(userType: string | undefined): string {
  const base = userType === "lawyer" ? "/auth/lawyer/sign-in" : "/auth/client/sign-in"
  return `${base}?message=email-confirmed`
}

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
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

      const code = searchParams.get("code")
      let linkType: string | null = linkTypeParam

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeError) {
          if (!cancelled) setError(exchangeError.message)
          return
        }
      } else {
        const hash = window.location.hash.replace(/^#/, "")
        if (!hash) {
          if (!cancelled) setError("Invalid or expired link.")
          return
        }
        const hashParams = new URLSearchParams(hash)
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
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`)
      }

      if (cancelled) return

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        if (!cancelled) setError("Could not complete authentication. Please try again.")
        return
      }

      const userType = user.user_metadata?.user_type as string | undefined
      const isRecovery =
        safeNext === "/auth/reset-password" ||
        linkType === "recovery" ||
        Boolean(user.recovery_sent_at)

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
          <p className="text-sm text-destructive text-center">{error}</p>
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
          <p className="text-sm text-muted-foreground">Completing sign-in…</p>
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
