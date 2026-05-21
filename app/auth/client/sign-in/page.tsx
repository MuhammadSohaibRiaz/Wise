"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Loader2, ArrowLeft } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { useEmailVerificationUrl } from "@/hooks/use-email-verification-url"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  appendNextToAuthPath,
  sanitizeClientPostAuthNext,
} from "@/lib/auth/client-booking-return"

export default function ClientSignInPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [bannerMessage, setBannerMessage] = useState<string | null>(null)
  const [successBanner, setSuccessBanner] = useState(false)
  const [resendEmail, setResendEmail] = useState("")
  const [isResending, setIsResending] = useState(false)
  const [showResendVerification, setShowResendVerification] = useState(false)
  const [postAuthNext, setPostAuthNext] = useState<string | null>(null)
  const verification = useEmailVerificationUrl("client")

  const showError = (msg: string) => toast({ variant: "destructive", title: "Error", description: msg })
  const showSuccess = (msg: string) => toast({ variant: "success", title: "Success", description: msg })

  useEffect(() => {
    if (verification.status === "verified") {
      const msg = "Email verified successfully! You can now sign in."
      setSuccessBanner(true)
      setBannerMessage(msg)
      showSuccess(msg)
      return
    }
    if (verification.status === "link-expired") {
      setShowResendVerification(true)
      setBannerMessage(
        "This verification link has expired. Resend a new link below, then use only the latest email.",
      )
      showError("Verification link expired. Please resend and use the newest email only.")
      return
    }
    if (verification.status === "error") {
      showError(verification.message)
    }
  }, [verification])

  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    setPostAuthNext(sanitizeClientPostAuthNext(params.get("next")))
    if (params.get("message") === "password-reset") {
      const msg = "Your password was reset. Sign in with your new password."
      setSuccessBanner(true)
      setBannerMessage(msg)
      showSuccess(msg)
      window.history.replaceState(null, "", window.location.pathname)
      return
    }
    if (params.get("message") === "email-confirmed" || params.get("confirmed") === "1") {
      const msg = "Email verified successfully! You can now sign in."
      setSuccessBanner(true)
      setBannerMessage(msg)
      showSuccess(msg)
      window.history.replaceState(null, "", window.location.pathname)
      return
    }
    if (params.get("error") === "unverified") {
      setShowResendVerification(true)
      setBannerMessage(
        "Please verify your email address before signing in. Check your inbox for the verification link.",
      )
      return
    }
    if (params.get("error") === "link-expired") {
      setShowResendVerification(true)
      setBannerMessage(
        "This verification link has expired. Resend a new link below, then use only the latest email.",
      )
      showError("Verification link expired. Please resend and use the newest email only.")
      return
    }
    if (params.get("message") === "sign-in-to-book") {
      setBannerMessage("Sign in as a client to book a consultation with this lawyer.")
    }
  }, [])

  useEffect(() => {
    const redirectIfAlreadySignedIn = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from("profiles")
        .select("user_type, email_verified_at")
        .eq("id", user.id)
        .maybeSingle()

      if (profile?.user_type !== "client" || !profile.email_verified_at) return

      const destination = postAuthNext || "/client/dashboard"
      router.replace(destination)
    }

    void redirectIfAlreadySignedIn()
  }, [postAuthNext, router])

  const handleResendVerification = async () => {
    const targetEmail = resendEmail.trim().toLowerCase() || email.trim().toLowerCase()
    if (!targetEmail) {
      showError("Enter your email address to resend the verification link.")
      return
    }
    setIsResending(true)
    try {
      const res = await fetch("/api/auth/send-verification-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, userType: "client" }),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        showError((payload as { error?: string }).error || "Could not resend verification email.")
        return
      }
      showSuccess("If an unverified account exists for that email, we sent a new verification link.")
    } finally {
      setIsResending(false)
    }
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const supabase = createClient()

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (signInError) {
        if (signInError.message.includes("Invalid login credentials")) {
          showError("Invalid email or password. Please try again.")
        } else if (signInError.message.includes("Email not confirmed")) {
          showError("Please confirm your email before signing in.")
        } else {
          showError(signInError.message)
        }
        setIsLoading(false)
        return
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !user) {
        showError("Failed to verify account. Please try again.")
        setIsLoading(false)
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_type, email_verified_at")
        .eq("id", user.id)
        .single()

      if (profileError || !profile) {
        showError("Failed to verify account. Please try again.")
        await supabase.auth.signOut()
        setIsLoading(false)
        return
      }

      if (!profile.email_verified_at) {
        await supabase.auth.signOut()
        showError(
          "Please verify your email address before signing in. Check your inbox for the verification link.",
        )
        setIsLoading(false)
        return
      }

      if (profile.user_type !== "client") {
        await supabase.auth.signOut()
        showError(
          profile.user_type === "lawyer"
            ? "This is a lawyer account. Please use the lawyer sign-in page."
            : "Invalid account type. Please contact support.",
        )
        setIsLoading(false)
        return
      }

      showSuccess("Sign in successful! Redirecting...")
      const nextPath =
        typeof window !== "undefined"
          ? sanitizeClientPostAuthNext(new URLSearchParams(window.location.search).get("next"))
          : postAuthNext
      router.push(nextPath || "/client/dashboard")
    } catch (err) {
      showError("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4 relative">
      <Link
        href="/"
        className="absolute top-4 right-4 sm:top-6 sm:right-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors z-10"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">Client Sign In</h1>
          <p className="text-muted-foreground">Access your legal cases and consultations</p>
        </div>

        {verification.status === "verifying" && (
          <div className="flex items-center justify-center gap-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Verifying your email…
          </div>
        )}

        {bannerMessage && (
          <Alert
            className={
              successBanner
                ? "border-green-500/50 bg-green-50 text-green-950 dark:bg-green-950/30 dark:text-green-100"
                : undefined
            }
          >
            <AlertTitle>{successBanner ? "Email verified" : "Notice"}</AlertTitle>
            <AlertDescription>{bannerMessage}</AlertDescription>
          </Alert>
        )}

        {showResendVerification && (
            <div className="space-y-2 rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">
                Did not receive the email? Enter your address and resend the verification link.
              </p>
              <Input
                type="email"
                placeholder="you@example.com"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                disabled={isResending}
              />
              <Button type="button" variant="outline" className="w-full" onClick={handleResendVerification} disabled={isResending}>
                {isResending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Resend verification email
              </Button>
            </div>
          )}

        <form onSubmit={handleSignIn} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/auth/forgot-password?from=client" className="text-sm text-blue-600 hover:underline">
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <div className="text-center text-sm">
          <p className="text-muted-foreground">
            New here?{" "}
            <Link
              href={appendNextToAuthPath("/auth/client/register", postAuthNext, {
                message: "sign-in-to-book",
              })}
              className="text-blue-600 hover:underline font-medium"
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
