"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { ShieldCheck, Lock, Loader2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"

export default function AdminSignInPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [adminPin, setAdminPin] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const REQUIRED_PIN = "1234" 

  const showError = (msg: string) => toast({ variant: "destructive", title: "Error", description: msg })
  const showSuccess = (msg: string) => toast({ variant: "success", title: "Success", description: msg })

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    if (adminPin !== REQUIRED_PIN) {
      showError("Invalid Security PIN. Access denied.")
      setIsLoading(false)
      return
    }

    try {
      const supabase = createClient()

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (signInError) {
        showError(signInError.message)
        setIsLoading(false)
        return
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !user) {
        showError("Failed to verify account.")
        setIsLoading(false)
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .single()

      if (profileError || !profile) {
        showError("Failed to verify account permissions.")
        await supabase.auth.signOut()
        setIsLoading(false)
        return
      }

      if (profile.user_type !== "admin") {
        await supabase.auth.signOut()
        showError("This account does not have administrative privileges.")
        setIsLoading(false)
        return
      }

      showSuccess("Welcome, Admin. Redirecting...")
      setTimeout(() => {
        router.push("/admin/lawyers")
      }, 1500)
    } catch (err) {
      showError("An unexpected error occurred.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#020617] px-4 py-6">
      <div className="w-full max-w-md space-y-5 bg-slate-900/50 backdrop-blur-xl p-6 rounded-2xl border border-slate-800 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)]">
        <div className="space-y-2 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-blue-500/15 rounded-2xl border border-blue-400/30 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
              <ShieldCheck className="h-10 w-10 text-blue-400" />
            </div>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            WiseCase <span className="text-blue-400 font-extrabold">Admin</span>
          </h1>
          <p className="text-slate-400 font-medium text-sm">Secure Administrative Portal</p>
        </div>

        <form onSubmit={handleSignIn} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-slate-300 ml-1 text-sm">Admin Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@wisecase.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-11 bg-slate-950/50 border-slate-800 text-white placeholder:text-slate-600 focus:ring-primary/50 transition-all"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-slate-300 ml-1 text-sm">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-11 bg-slate-950/50 border-slate-800 text-white placeholder:text-slate-600 focus:ring-primary/50 transition-all"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pin" className="flex items-center gap-2 text-slate-300 ml-1 text-sm">
              <Lock className="h-3 w-3" /> Security PIN
            </Label>
            <Input
              id="pin"
              type="password"
              maxLength={4}
              placeholder="0000"
              value={adminPin}
              onChange={(e) => setAdminPin(e.target.value)}
              required
              className="h-12 bg-slate-950 border-slate-700 text-white text-center tracking-[0.8em] text-lg font-mono focus:border-primary transition-all"
              disabled={isLoading}
            />
          </div>

          <Button type="submit" className="w-full h-11 text-base font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Authenticating...
              </>
            ) : "Access Dashboard"}
          </Button>
        </form>

        <div className="text-center pt-2">
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
            Return to Public Site
          </Link>
        </div>
      </div>
    </main>
  )
}

// Dummy import to satisfy Next.js if Link is needed but not imported
import Link from "next/link"
