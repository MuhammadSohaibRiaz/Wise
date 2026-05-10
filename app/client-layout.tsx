"use client"

import type React from "react"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "@/components/theme-provider"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Suspense } from "react"
import { usePathname } from "next/navigation"
import { ProgressBar } from "@/components/progress-bar"
import { Toaster } from "@/components/ui/toaster"

export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const pathname = usePathname()

  const isDashboardRoute = pathname?.startsWith("/client") || pathname?.startsWith("/lawyer")

  return (
    <ThemeProvider defaultTheme="system" enableSystem className="theme-law">
      <ProgressBar />
      <Suspense fallback={<div>Loading...</div>}>
        {!isDashboardRoute && <SiteHeader />}
        <main role="main" className={isDashboardRoute ? "" : "min-h-[60vh]"}>
          {children}
        </main>
        {!isDashboardRoute && <SiteFooter />}
      </Suspense>
      <Analytics />
      <Toaster />
    </ThemeProvider>
  )
}
