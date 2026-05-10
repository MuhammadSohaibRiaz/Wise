"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { AuthAlert } from "@/components/auth/auth-alert"
import { createClient } from "@/lib/supabase/client"
import { ArrowLeft } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setIsLoading(true)

    try {
      const supabase = createClient()

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL
          ? `${process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL}/auth/reset-password`
          : `${window.location.origin}/auth/reset-password`,
      })

      if (resetError) {
        console.log("[v0] Password reset error:", resetError)
        setError(resetError.message)
        return
      }

      setSuccess(
        "Password reset link sent! Check your email for instructions. If you don't see it in 5 minutes, check your spam folder.",
      )
      setSubmitted(true)
      setEmail("")
    } catch (err) {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2">
          <Link
            href="/auth/client/sign-in"
            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
        </div>

        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">Reset Password</h1>
          <p className="text-muted-foreground">Enter your email and we'll send you a link to reset your password</p>
        </div>

        {error && <AuthAlert type="error" message={error} />}
        {success && <AuthAlert type="success" message={success} />}

        {!submitted ? (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">We'll send a password reset link to this email address</p>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Sending..." : "Send reset link"}
            </Button>
          </form>
        ) : (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Check your email for a password reset link. The link will expire in 1 hour.
            </p>
            <Button onClick={() => setSubmitted(false)} variant="outline" className="w-full">
              Try another email
            </Button>
          </div>
        )}

        <div className="text-center text-sm text-muted-foreground space-y-2">
          <p>Remember your password?</p>
          <div className="flex gap-2 justify-center">
            <Link href="/auth/client/sign-in" className="text-blue-600 hover:underline">
              Client Sign In
            </Link>
            <span>•</span>
            <Link href="/auth/lawyer/sign-in" className="text-blue-600 hover:underline">
              Lawyer Sign In
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
