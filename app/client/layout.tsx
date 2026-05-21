"use client"

import type React from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ClientSidebar } from "@/components/client/sidebar"
import { ClientHeader } from "@/components/client/header"
import { useState, useEffect, useMemo, Suspense } from "react"
import { createClient } from "@/lib/supabase/client"
import { ProgressBar } from "@/components/progress-bar"

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const toggleSidebar = useMemo(() => () => setSidebarOpen((prev) => !prev), [])

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setIsAuthenticated(false)
        setIsLoading(false)
        return
      }
      setIsAuthenticated(true)

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

    init()
  }, [])

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

  const isPublicLawyerProfile = /^\/client\/lawyer\/[^/]+/.test(pathname)

  if (!isAuthenticated && isPublicLawyerProfile) {
    return (
      <>
        <Suspense fallback={null}><ProgressBar /></Suspense>
        <div className="min-h-screen bg-background">
          <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
              <Link href="/" className="flex items-center gap-2 text-lg font-bold text-foreground">
                <span className="relative h-8 w-8 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-border">
                  <Image
                    src="/wisecase-logo.png"
                    alt="WiseCase"
                    fill
                    sizes="32px"
                    className="object-contain p-0.5"
                    priority
                  />
                </span>
                WiseCase
              </Link>
              <Link
                href="/auth/client/sign-in"
                className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
              >
                Sign In
              </Link>
            </div>
          </header>
          <main>
            <div className="p-4 md:p-6 lg:p-8">{children}</div>
          </main>
        </div>
      </>
    )
  }

  return (
    <>
      <Suspense fallback={null}><ProgressBar /></Suspense>
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

