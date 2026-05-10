"use client"

import type React from "react"
import { useRouter, usePathname } from "next/navigation"
import { ClientSidebar } from "@/components/client/sidebar"
import { ClientHeader } from "@/components/client/header"
import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { ProgressBar } from "@/components/progress-bar"

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // All hooks must be called before any conditional returns
  const toggleSidebar = useMemo(() => () => setSidebarOpen((prev) => !prev), [])

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push("/auth/client/sign-in")
        return
      }

      // Check user_type - only allow clients
      const { data: profile } = await supabase.from("profiles").select("user_type").eq("id", session.user.id).single()

      if (profile?.user_type !== "client") {
        router.push(profile?.user_type === "lawyer" ? "/lawyer/dashboard" : "/auth/client/sign-in")
        return
      }

      setIsAuthenticated(true)
      // Set initial state based on screen size
      const handleResize = () => {
        if (window.innerWidth >= 768) {
          setSidebarOpen(true)
        }
      }

      handleResize()
      window.addEventListener("resize", handleResize)
      setIsLoading(false)
      return () => window.removeEventListener("resize", handleResize)
    }

    checkAuth()
  }, [router])

  // Only re-check auth on pathname change if not authenticated
  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      const checkAuth = async () => {
        const supabase = createClient()
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (!session) {
          router.push("/auth/client/sign-in")
        }
      }
      checkAuth()
    }
  }, [pathname, isAuthenticated, isLoading, router])

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

  return (
    <>
      <ProgressBar />
      <div className="flex h-screen bg-background overflow-hidden">
        {/* Sidebar */}
        <ClientSidebar open={sidebarOpen} onToggle={toggleSidebar} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <ClientHeader onMenuClick={toggleSidebar} />

        {/* Page Content - Only this section re-renders on navigation */}
        <main key={pathname} className="flex-1 overflow-auto">
          <div className="p-4 md:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
    </>
  )
}



