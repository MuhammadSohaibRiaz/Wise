"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { AuthAlert } from "@/components/auth/auth-alert"
import { createClient } from "@/lib/supabase/client"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LAW_SPECIALIZATIONS } from "@/lib/specializations"
import { FileUpload } from "@/components/auth/file-upload"
import { Loader2 } from "lucide-react"

export default function LawyerRegisterPage() {
  const router = useRouter()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [barLicense, setBarLicense] = useState("")
  const [practiceArea, setPracticeArea] = useState("")
  const [licenseFile, setLicenseFile] = useState<File | null>(null)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long")
      return
    }

    if (!barLicense.trim()) {
      setError("Bar license number is required")
      return
    }

    if (!/^PKB-\d{6}$/.test(barLicense.trim())) {
      setError("Bar license must be in format PKB-XXXXXX (e.g. PKB-123456)")
      return
    }

    if (!practiceArea.trim()) {
      setError("Please select a primary practice area")
      return
    }

    if (!licenseFile) {
      setError("Please upload your bar license document for admin verification")
      return
    }

    setIsLoading(true)

    try {
      const supabase = createClient()
      const normalizedEmail = email.trim().toLowerCase()

      // 1. SIGN UP
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            user_type: "lawyer",
            bar_license: barLicense,
            practice_area: practiceArea,
          },
          emailRedirectTo:
            process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${window.location.origin}/auth/callback`,
        },
      })

      if (signUpError) {
        setError(signUpError.message)
        setIsLoading(false)
        return
      }

      if (data.user) {
        // 2. UPLOAD LICENSE FILE
        const fileExt = licenseFile.name.split(".").pop()
        const fileName = `${data.user.id}-${Date.now()}.${fileExt}`
        const filePath = `licenses/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from("verifications")
          .upload(filePath, licenseFile)

        if (uploadError) {
          console.error("Storage upload error:", uploadError)
          setSuccess("Account created, but license upload failed. You can upload it later from your profile.")
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from("verifications")
            .getPublicUrl(filePath)

          // 3. UPDATE LAWYER PROFILE
          await supabase
            .from("lawyer_profiles")
            .update({
              bar_license_number: barLicense,
              specializations: [practiceArea],
              license_file_url: publicUrl,
              verification_status: "pending",
              verified: false
            })
            .eq("id", data.user.id)

          setSuccess("Registration successful! Your account is now pending admin verification. Please check your email to confirm your account.")
        }

        setTimeout(() => router.push("/auth/lawyer/sign-in"), 1000)
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">Join as a Lawyer</h1>
          <p className="text-muted-foreground">Submit your credentials for verification</p>
        </div>

        {error && <AuthAlert type="error" message={error} />}
        {success && <AuthAlert type="success" message={success} />}

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
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
            <Label htmlFor="barLicense">Bar License Number</Label>
            <Input
              id="barLicense"
              placeholder="PKB-123456"
              value={barLicense}
              maxLength={10}
              onChange={(e) => {
                let v = e.target.value.toUpperCase()
                if (v.length <= 4) {
                  v = v.replace(/[^A-Z-]/g, "")
                } else {
                  v = v.slice(0, 4) + v.slice(4).replace(/[^0-9]/g, "")
                }
                setBarLicense(v)
              }}
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="practiceArea">Primary Practice Area</Label>
            <Select value={practiceArea} onValueChange={setPracticeArea} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder="Select specialization" />
              </SelectTrigger>
              <SelectContent>
                {LAW_SPECIALIZATIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="licenseFile">Bar License Document</Label>
            <FileUpload onFileSelect={setLicenseFile} accept="image/*,.pdf" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? <Loader2 className="animate-spin" /> : "Create Account"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account? <Link href="/auth/lawyer/sign-in" className="text-primary hover:underline">Sign in</Link>
        </p>
      </div>
    </main>
  )
}
