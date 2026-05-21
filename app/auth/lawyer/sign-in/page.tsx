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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function LawyerSignInPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [bannerMessage, setBannerMessage] = useState<string | null>(null)

  const showError = (msg: string) => toast({ variant: "destructive", title: "Error", description: msg })
  const showSuccess = (msg: string) => toast({ variant: "success", title: "Success", description: msg })

  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    if (params.get("confirmed") === "1") {
      setBannerMessage(
        "Email confirmed. You can now sign in. Your lawyer verification may still be pending admin review.",
      )
      window.history.replaceState(null, "", window.location.pathname)
      return
    }
    if (params.get("error") === "unverified") {
      setBannerMessage(
        "Please verify your email address before signing in. Check your inbox for the verification link.",
      )
    }
  }, [])

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

      if (!user.email_confirmed_at) {
        await supabase.auth.signOut()
        showError(
          "Please verify your email address before signing in. Check your inbox for the verification link.",
        )
        setIsLoading(false)
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .single()

      if (profileError || !profile) {
        showError("Failed to verify account. Please try again.")
        await supabase.auth.signOut()
        setIsLoading(false)
        return
      }

      if (profile.user_type !== "lawyer") {
        await supabase.auth.signOut()
        showError(
          profile.user_type === "client"
            ? "This is a client account. Please use the client sign-in page."
            : "Invalid account type. Please contact support.",
        )
        setIsLoading(false)
        return
      }

      showSuccess("Sign in successful! Redirecting...")
      router.push("/lawyer/dashboard")
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
          <h1 className="text-3xl font-bold">Lawyer Sign In</h1>
          <p className="text-muted-foreground">Manage your cases and consultations</p>
        </div>

        {bannerMessage && (
          <Alert>
            <AlertTitle>Notice</AlertTitle>
            <AlertDescription>{bannerMessage}</AlertDescription>
          </Alert>
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
              <Link href="/auth/forgot-password" className="text-sm text-blue-600 hover:underline">
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
            New to the platform?{" "}
            <Link href="/auth/lawyer/register" className="text-blue-600 hover:underline font-medium">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
