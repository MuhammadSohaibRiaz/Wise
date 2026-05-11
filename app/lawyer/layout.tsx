"use client"

import type React from "react"
import { useState, useEffect, useMemo, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Menu, X, ShieldAlert, Clock, LogOut, Upload, Loader2, XCircle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LawyerSidebar } from "@/components/lawyer/sidebar"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"

export default function LawyerLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null)

  // All hooks must be called before any conditional returns
  const toggleSidebar = useMemo(() => () => setSidebarOpen((prev) => !prev), [])
  const closeSidebar = useMemo(() => () => setSidebarOpen(false), [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/lawyer/sign-in")
  }

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push("/auth/lawyer/sign-in")
        return
      }

      // Check user_type
      const { data: profile } = await supabase.from("profiles").select("user_type").eq("id", session.user.id).single()

      if (profile?.user_type !== "lawyer") {
        router.push(profile?.user_type === "client" ? "/client/dashboard" : "/auth/lawyer/sign-in")
        return
      }

      // Check verification status
      const { data: lawyerProfile } = await supabase
        .from("lawyer_profiles")
        .select("verified, verification_status")
        .eq("id", session.user.id)
        .single()

      setIsAuthenticated(true)
      setIsVerified(lawyerProfile?.verified || false)
      setVerificationStatus(lawyerProfile?.verification_status || "pending")

      const handleResize = () => {
        if (window.innerWidth >= 768) {
          setSidebarOpen(true)
        } else {
          setSidebarOpen(false)
        }
      }

      handleResize()
      window.addEventListener("resize", handleResize)
      setIsLoading(false)
      return () => window.removeEventListener("resize", handleResize)
    }

    checkAuth()
  }, [router])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Verification Pending / Rejected Screen
  if (!isVerified) {
    const isRejected = verificationStatus === "rejected"
    return (
      <LawyerVerificationScreen
        status={verificationStatus}
        isRejected={isRejected}
        onSignOut={handleSignOut}
        onResubmitted={() => setVerificationStatus("pending")}
      />
    )
  }

  return (
    <>
      <div className="min-h-screen bg-background">
        <Button
          variant="ghost"
          size="icon"
          className="fixed top-4 right-4 z-50 md:hidden bg-background border shadow-sm"
          onClick={toggleSidebar}
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>

        <div
          className={`fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity ${
            sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          onClick={closeSidebar}
        />

        <aside
          className={`fixed top-0 left-0 h-full bg-background border-r z-40 transition-transform duration-300 md:hidden ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } w-64 overflow-y-auto`}
        >
          <div className="p-4 pt-16">
            <LawyerSidebar onNavigate={closeSidebar} />
          </div>
        </aside>

        {/* Desktop Sidebar Integrated via CSS/Layout if needed, but the original layout uses absolute positioning for aside */}
        <div className="hidden md:flex md:flex-col fixed top-0 left-0 h-full w-64 bg-background border-r z-30 overflow-hidden">
          <div className="p-4 flex-1 min-h-0 overflow-y-auto overscroll-contain">
            <LawyerSidebar />
          </div>
        </div>

        <main key={pathname} className="w-full md:pl-64">{children}</main>
      </div>
    </>
  )
}

function LawyerVerificationScreen({
  status,
  isRejected,
  onSignOut,
  onResubmitted,
}: {
  status: string | null
  isRejected: boolean
  onSignOut: () => void
  onResubmitted: () => void
}) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setSelectedFile(file)
  }

  const handleResubmit = async () => {
    if (!selectedFile) return
    try {
      setIsUploading(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not signed in")

      const fileExt = selectedFile.name.split(".").pop()
      const fileName = `${user.id}-license-${Date.now()}.${fileExt}`
      const { error: uploadError } = await supabase.storage
        .from("verifications")
        .upload(fileName, selectedFile)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from("verifications")
        .getPublicUrl(fileName)

      const { error: updateError } = await supabase
        .from("lawyer_profiles")
        .update({
          license_file_url: publicUrl,
          verified: false,
          verified_at: null,
          verification_status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)

      if (updateError) throw updateError

      toast({
        title: "Document resubmitted",
        description: "Your license has been sent for review. You will be notified once verified.",
      })
      setSelectedFile(null)
      onResubmitted()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Upload failed"
      toast({ title: "Error", description: message, variant: "destructive" })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className={`w-full max-w-md shadow-xl border-t-4 ${isRejected ? "border-t-red-500" : "border-t-orange-500"}`}>
        <CardHeader className="text-center">
          <div className={`mx-auto p-3 rounded-full w-fit mb-4 ${isRejected ? "bg-red-100" : "bg-orange-100"}`}>
            {isRejected ? (
              <XCircle className="h-8 w-8 text-red-600" />
            ) : (
              <Clock className="h-8 w-8 text-orange-600" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {isRejected ? "Verification Rejected" : "Verification Pending"}
          </CardTitle>
          <CardDescription>
            {isRejected
              ? "Your license document was rejected by the admin team. Please upload a clearer or updated document."
              : "Your account is currently under review by our administration team."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className={`p-4 rounded-lg border flex gap-3 text-left ${isRejected ? "bg-red-50 border-red-100" : "bg-orange-50 border-orange-100"}`}>
            <ShieldAlert className={`h-5 w-5 shrink-0 mt-0.5 ${isRejected ? "text-red-600" : "text-orange-600"}`} />
            <p className={`text-sm ${isRejected ? "text-red-800" : "text-orange-800"}`}>
              {isRejected
                ? "Common rejection reasons: blurry image, expired license, incomplete document, or unreadable text. Please ensure the new upload is clear and valid."
                : "To ensure platform safety, all lawyers must be manually verified. This process usually takes 24-48 hours."}
            </p>
          </div>

          {isRejected && (
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={handleFileSelect}
              />

              {selectedFile ? (
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedFile(null)}
                    className="shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Select New License Document
                </Button>
              )}

              <Button
                className="w-full gap-2"
                disabled={!selectedFile || isUploading}
                onClick={handleResubmit}
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {isUploading ? "Uploading..." : "Resubmit for Verification"}
              </Button>
            </div>
          )}

          <p className="text-sm text-muted-foreground italic text-center">
            Status: <span className="font-bold capitalize">{status}</span>
          </p>

          <div className="pt-4 border-t space-y-3">
            <p className="text-xs text-muted-foreground text-center">
              Need help? Contact us at support@wisecase.pk
            </p>
            <Button variant="outline" className="w-full gap-2" onClick={onSignOut}>
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
