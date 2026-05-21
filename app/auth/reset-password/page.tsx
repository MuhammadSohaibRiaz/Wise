"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { toast } from "@/hooks/use-toast"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [hasResetSession, setHasResetSession] = useState(false)

  const showError = (msg: string) => toast({ variant: "destructive", title: "Error", description: msg })
  const showSuccess = (msg: string) => toast({ variant: "success", title: "Success", description: msg })

  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      setHasResetSession(Boolean(session))
      setIsCheckingSession(false)
    }

    void checkSession()
  }, [])

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

      showSuccess("Password reset successfully! Redirecting to sign in...")
      setTimeout(() => {
        router.push(signInPath)
      }, 2000)
    } catch (err) {
      showError("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4 relative">
      <Link
        href="/auth/client/sign-in"
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
            Verifying password reset link...
          </div>
        ) : !hasResetSession ? (
          <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-800">
            <p>This password reset link is invalid or expired. Please request a new reset link.</p>
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
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
