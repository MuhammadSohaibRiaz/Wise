"use client"

import type React from "react"

import { Suspense, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { establishSessionFromAuthUrl } from "@/lib/auth/establish-session-from-url"
import Link from "next/link"
import { ArrowLeft, Loader2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [hasResetSession, setHasResetSession] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const sessionCheckRef = useRef(false)

  const showError = (msg: string) => toast({ variant: "destructive", title: "Error", description: msg })
  const showSuccess = (msg: string) => toast({ variant: "success", title: "Success", description: msg })

  useEffect(() => {
    if (sessionCheckRef.current) return
    sessionCheckRef.current = true

    const checkSession = async () => {
      const supabase = createClient()

      let hashRaw = window.location.hash
      if (!hashRaw) {
        hashRaw = ""
      }

      const hasAuthParams =
        Boolean(hashRaw) ||
        searchParams.has("code") ||
        searchParams.get("type") === "recovery"

      if (hasAuthParams) {
        const result = await establishSessionFromAuthUrl(supabase, {
          searchParams,
          hashFromWindow: hashRaw,
        })

        if (!result.ok) {
          setLinkError(result.error)
          setHasResetSession(false)
          setIsCheckingSession(false)
          return
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()

      setHasResetSession(Boolean(session))
      setIsCheckingSession(false)
    }

    void checkSession()
  }, [searchParams])

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      showError("Passwords do not match")
      return
    }

    if (password.length < 6) {
      showError("Password must be at least 6 characters long")
      return
    }

    setIsLoading(true)

    try {
      const supabase = createClient()

      const { error: updateError } = await supabase.auth.updateUser({
        password,
      })

      if (updateError) {
        showError(updateError.message)
        return
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()
      const userType = user?.user_metadata?.user_type as string | undefined
      const signInPath = userType === "lawyer" ? "/auth/lawyer/sign-in" : "/auth/client/sign-in"

      await supabase.auth.signOut()

      showSuccess("Password reset successfully! Redirecting to sign in...")
      setTimeout(() => {
        router.push(`${signInPath}?message=password-reset`)
      }, 1500)
    } catch {
      showError("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4 relative">
      <Link
        href="/auth/forgot-password"
        className="absolute top-4 right-4 sm:top-6 sm:right-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors z-10"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">Create New Password</h1>
          <p className="text-muted-foreground">Enter your new password below</p>
        </div>

        {isCheckingSession ? (
          <div className="rounded-lg border bg-card p-4 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
            Verifying password reset link...
          </div>
        ) : !hasResetSession ? (
          <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-800">
            <p>
              {linkError ??
                "This password reset link is invalid or expired. Please request a new reset link."}
            </p>
            <Link href="/auth/forgot-password" className="font-medium text-amber-900 underline">
              Request a new link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">At least 6 characters</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="********"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Resetting..." : "Reset password"}
            </Button>
          </form>
        )}

        <div className="text-center text-sm">
          <p className="text-muted-foreground">
            <Link href="/auth/client/sign-in" className="text-blue-600 hover:underline">
              Client sign in
            </Link>
            {" · "}
            <Link href="/auth/lawyer/sign-in" className="text-blue-600 hover:underline">
              Lawyer sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  )
}
