"use client"

import type React from "react"
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { getEmailVerificationRedirectUrl } from "@/lib/auth/redirect-urls"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LAW_SPECIALIZATIONS } from "@/lib/specializations"
import { FileUpload } from "@/components/auth/file-upload"
import { Loader2, ArrowLeft, MailCheck } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

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
  const [isLoading, setIsLoading] = useState(false)
  const [registrationComplete, setRegistrationComplete] = useState(false)
  const submitButtonRef = useRef<HTMLButtonElement>(null)

  const showError = (msg: string) =>
    toast({ variant: "destructive", title: "Error", description: msg, duration: 5000 })
  const showSuccess = (msg: string) =>
    toast({ variant: "success", title: "Success", description: msg, duration: 5000 })

  const normalizeBarLicenseInput = (value: string) =>
    value
      .toUpperCase()
      .replace(/[^A-Z0-9/-]/g, "")
      .slice(0, 13)

  const isValidBarLicense = (value: string) =>
    /^(PB-\d{5}\/\d{4}|SBC-\d{4}|KP-\d{4}\/\d{2}|IBC-\d{4}|BBC-\d{4})$/.test(value)

  const barLicenseFormatMessage =
    "Enter a valid bar license: PB-12345/2022, SBC-5678, KP-9876/21, IBC-1234, or BBC-4321."

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedFirstName = firstName.trim()
    const trimmedLastName = lastName.trim()
    const normalizedEmail = email.trim().toLowerCase()
    const normalizedBarLicense = barLicense.trim().toUpperCase()

    if (!trimmedFirstName) {
      showError("First name is required")
      return
    }

    if (!trimmedLastName) {
      showError("Last name is required")
      return
    }

    if (!normalizedEmail) {
      showError("Email is required")
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      showError("Please enter a valid email address")
      return
    }

    if (password !== confirmPassword) {
      showError("Passwords do not match")
      return
    }

    if (!password) {
      showError("Password is required")
      return
    }

    if (password.length < 6) {
      showError("Password must be at least 6 characters long")
      return
    }

    if (!normalizedBarLicense) {
      showError("Bar license number is required")
      return
    }

    if (!isValidBarLicense(normalizedBarLicense)) {
      showError(barLicenseFormatMessage)
      return
    }

    if (!practiceArea.trim()) {
      showError("Please select a primary practice area")
      return
    }

    if (!licenseFile || licenseFile.size <= 0) {
      showError("Please upload your bar license document before creating your account.")
      return
    }

    setIsLoading(true)

    try {
      const supabase = createClient()
      const emailRedirectTo = getEmailVerificationRedirectUrl("lawyer")

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            first_name: trimmedFirstName,
            last_name: trimmedLastName,
            user_type: "lawyer",
            bar_license: normalizedBarLicense,
            practice_area: practiceArea,
          },
          emailRedirectTo,
        },
      })

      if (signUpError) {
        showError(signUpError.message)
        setIsLoading(false)
        return
      }

      if (data.user) {
        const fileExt = licenseFile.name.split(".").pop()
        const fileName = `${data.user.id}-${Date.now()}.${fileExt}`
        const filePath = `licenses/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from("verifications")
          .upload(filePath, licenseFile)

        if (uploadError) {
          console.error("Storage upload error:", uploadError)
          showError("Account created, but license upload failed. Verify your email, then upload your license from your profile.")
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from("verifications")
            .getPublicUrl(filePath)

          await supabase
            .from("lawyer_profiles")
            .update({
              bar_license_number: normalizedBarLicense,
              specializations: [practiceArea],
              license_file_url: publicUrl,
              verification_status: "pending",
              verified: false
            })
            .eq("id", data.user.id)

        }

        await supabase.auth.signOut()

        const verifyRes = await fetch("/api/auth/send-verification-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail, userType: "lawyer" }),
        })
        if (!verifyRes.ok) {
          const payload = await verifyRes.json().catch(() => ({}))
          showError(
            (payload as { error?: string }).error ||
              "Account created but we could not send the verification email. Try again from the sign-in page.",
          )
        } else {
          showSuccess("Account created! Please verify your email address. Check your inbox for a verification link.")
        }

        setRegistrationComplete(true)
      }
    } catch (err: any) {
      showError(err.message || "An unexpected error occurred.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4 py-12 relative">
      <Link
        href="/auth/lawyer/sign-in"
        className="absolute top-4 right-4 sm:top-6 sm:right-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors z-10"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">Join as a Lawyer</h1>
          <p className="text-muted-foreground">Submit your credentials for verification</p>
        </div>

        {registrationComplete ? (
          <div className="space-y-4 rounded-lg border border-primary/30 bg-primary/5 p-6">
            <div className="flex justify-center">
              <MailCheck className="h-10 w-10 text-primary" />
            </div>
            <Alert>
              <AlertTitle>Account created!</AlertTitle>
              <AlertDescription>
                Please verify your email address. Check your inbox for a verification link. Your bar license will be
                reviewed by admin after your email is verified.
              </AlertDescription>
            </Alert>
            <Button className="w-full" onClick={() => router.push("/auth/lawyer/sign-in")}>
              Go to sign in
            </Button>
          </div>
        ) : (
        <form onSubmit={handleRegister} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                placeholder="John"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
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
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="barLicense">Bar License Number</Label>
            <Input
              id="barLicense"
              placeholder="PB-12345/2022"
              value={barLicense}
              maxLength={13}
              autoCapitalize="characters"
              onChange={(e) => setBarLicense(normalizeBarLicenseInput(e.target.value))}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Accepted: PB-12345/2022, SBC-5678, KP-9876/21, IBC-1234, BBC-4321.
            </p>
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
            <Label htmlFor="licenseFile">
              Bar License Document <span className="text-destructive">*</span>
              <span className="ml-1 text-xs font-normal text-muted-foreground">(Required)</span>
            </Label>
            <FileUpload
              onFileSelect={(file) => {
                setLicenseFile(file)
                window.setTimeout(() => submitButtonRef.current?.focus(), 0)
              }}
              onFileClear={() => setLicenseFile(null)}
              accept="image/*,.pdf"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
              disabled={isLoading}
            />
          </div>

          <Button
            ref={submitButtonRef}
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="animate-spin" /> : "Create Account"}
          </Button>
        </form>
        )}

        <p className="text-center text-sm text-muted-foreground">
          Already have an account? <Link href="/auth/lawyer/sign-in" className="text-primary hover:underline">Sign in</Link>
        </p>
      </div>
    </main>
  )
}
