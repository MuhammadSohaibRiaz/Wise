"use client"

import type React from "react"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ThemeToggle } from "./theme-provider"

export function SiteHeader() {
  const pathname = usePathname()

  const handleSectionClick = (e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    if (pathname !== "/") {
      // If not on home page, navigate to home with hash
      return // Let the default Link behavior handle it
    } else {
      // If on home page, smooth scroll to section
      e.preventDefault()
      const element = document.getElementById(sectionId)
      if (element) {
        element.scrollIntoView({ behavior: "smooth" })
      }
    }
  }

  return (
    <header className="w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="font-bold text-2xl tracking-tighter text-primary flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-bold">CW</span>
            </div>
            CaseWise
          </Link>
          
          <nav aria-label="Primary" className="hidden md:flex items-center gap-6">
            <Link
              href="/#features"
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
              onClick={(e) => handleSectionClick(e, "features")}
            >
              Features
            </Link>
            <Link
              href="/#how-it-works"
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
              onClick={(e) => handleSectionClick(e, "how-it-works")}
            >
              How it works
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/auth/lawyer/sign-in"
            className="hidden lg:block text-xs font-medium text-muted-foreground hover:text-primary px-3"
          >
            For Lawyers
          </Link>
          <div className="h-4 w-[1px] bg-border hidden lg:block mx-2" />
          
          <Link
            href="/auth/client/sign-in"
            className="text-sm font-medium hover:text-primary transition-colors px-3 py-2"
          >
            Sign In
          </Link>
          
          <Link
            href="/auth/client/register"
            className="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground px-5 py-2 text-sm font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all active:scale-95"
          >
            Join CaseWise
          </Link>
          
          <div className="ml-2">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  )
}
