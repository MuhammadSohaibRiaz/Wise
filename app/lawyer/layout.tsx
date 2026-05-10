"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Menu, X, ShieldAlert, Clock, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LawyerSidebar } from "@/components/lawyer/sidebar"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

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

  // Verification Pending Screen
  if (!isVerified) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-t-4 border-t-orange-500">
          <CardHeader className="text-center">
            <div className="mx-auto bg-orange-100 p-3 rounded-full w-fit mb-4">
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
            <CardTitle className="text-2xl">Verification Pending</CardTitle>
            <CardDescription>
              Your account is currently under review by our administration team.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 text-center">
            <div className="p-4 bg-orange-50 rounded-lg border border-orange-100 flex gap-3 text-left">
              <ShieldAlert className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
              <p className="text-sm text-orange-800">
                To ensure platform safety, all lawyers must be manually verified. This process usually takes 24-48 hours.
              </p>
            </div>
            
            <p className="text-sm text-muted-foreground italic">
              Status: <span className="font-bold capitalize">{verificationStatus}</span>
            </p>

            <div className="pt-4 border-t space-y-3">
              <p className="text-xs text-muted-foreground">
                Need help? Contact us at support@wisecase.pk
              </p>
              <Button variant="outline" className="w-full gap-2" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
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
