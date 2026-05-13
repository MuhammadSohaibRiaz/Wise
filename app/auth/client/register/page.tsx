"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Loader2, ArrowLeft } from "lucide-react"
import { toast } from "@/hooks/use-toast"

export default function ClientRegisterPage() {
  const router = useRouter()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const showError = (msg: string) => toast({ variant: "destructive", title: "Error", description: msg })
  const showSuccess = (msg: string) => toast({ variant: "success", title: "Success", description: msg })

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      showError("Passwords do not match")
      return
    }

    if (password.length < 6) {
      showError("Password must be at least 6 characters long")
      return
    }

    const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/
    if (!strongPassword.test(password)) {
      showError("Password must be at least 8 characters and include uppercase, lowercase, and a number.")
      return
    }

    setIsLoading(true)

    try {
      const supabase = createClient()
      const normalizedEmail = email.trim().toLowerCase()

      const { error: connectionError } = await supabase.from("profiles").select("id").limit(1)

      if (connectionError) {
        console.error("Supabase connection error:", connectionError)
        if (connectionError.message.includes("Invalid API key") || connectionError.message.includes("JWT")) {
          showError("Supabase connection failed! Please check your environment configuration.")
        } else {
          showError(`Connection error: ${connectionError.message}`)
        }
        setIsLoading(false)
        return
      }

      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .ilike("email", normalizedEmail)
        .maybeSingle()

      if (existingProfile) {
        showError("This email is already registered. Please sign in instead.")
        return
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            user_type: "client",
          },
          emailRedirectTo:
            process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${window.location.origin}/auth/callback`,
        },
      })

      if (signUpError) {
        console.error("Sign up error:", signUpError)
        if (signUpError.message.includes("already registered")) {
          showError("This email is already registered. Please sign in instead.")
        } else if (signUpError.message.includes("Invalid API key") || signUpError.message.includes("JWT")) {
          showError("Supabase configuration error! Please check your environment and restart the dev server.")
        } else {
          showError(signUpError.message)
        }
        return
      }

      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        showError("This email is already registered. Please sign in instead.")
        return
      }

      if (data.user) {
        showSuccess("Registration successful! Redirecting to sign in...")
        setTimeout(() => {
          router.push("/auth/client/sign-in")
        }, 800)
      }
    } catch (err: any) {
      console.error("Registration error:", err)
      showError(err.message || "An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4 py-12 relative">
      <Link
        href="/auth/client/sign-in"
        className="absolute top-4 right-4 sm:top-6 sm:right-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors z-10"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">Create Client Account</h1>
          <p className="text-muted-foreground">Find and book the right lawyer for your needs</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                type="text"
                placeholder="John"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                type="text"
                placeholder="Doe"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          </div>

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
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">At least 8 characters, with uppercase, lowercase, and a number</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <div className="text-center text-sm">
          <p className="text-muted-foreground">
            Already have an account?{" "}
            <Link href="/auth/client/sign-in" className="text-blue-600 hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
