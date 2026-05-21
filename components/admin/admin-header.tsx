"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useAdminCancellationSync } from "@/lib/hooks/use-admin-cancellation-sync"
import { Button } from "@/components/ui/button"
import { 
  ShieldCheck, 
  Menu, 
  X, 
  LogOut, 
  Users, 
  Briefcase, 
  LayoutDashboard,
  ShieldAlert,
  AlertCircle,
} from "lucide-react"
import Link from "next/link"

function CancellationNavBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="ml-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
      {count > 99 ? "99+" : count}
    </span>
  )
}

export function AdminHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [cancellationCount, setCancellationCount] = useState(0)
  const [syncEnabled, setSyncEnabled] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const loadCancellationCount = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/cancellation-requests/count", { cache: "no-store" })
      if (!res.ok) return
      const json = await res.json()
      setCancellationCount(json.total_actionable ?? 0)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .maybeSingle()
      if (profile?.user_type === "admin") {
        setSyncEnabled(true)
        void loadCancellationCount()
      }
    }
    void init()
  }, [loadCancellationCount, supabase])

  useAdminCancellationSync({
    enabled: syncEnabled,
    onSync: loadCancellationCount,
  })

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/auth/admin/sign-in")
  }

  return (
    <header className="border-b bg-white sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-lg">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <span className="font-bold text-xl tracking-tight hidden sm:block">
              WiseCase <span className="text-primary">Admin</span>
            </span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/admin/dashboard" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
            <Link href="/admin/lawyers" className="text-sm font-medium text-primary flex items-center gap-1.5">
              <Briefcase className="h-4 w-4" />
              Verifications
            </Link>
            <Link href="/admin/users" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              Users
            </Link>
            <Link href="/admin/cancellation-requests" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4" />
              Cancellations
              <CancellationNavBadge count={cancellationCount} />
            </Link>
            <Link href="/admin/security-logs" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              AI Security
            </Link>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-muted-foreground hover:text-destructive hidden sm:flex gap-2"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
            
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 rounded-md text-muted-foreground hover:bg-muted"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {isMenuOpen && (
        <div className="md:hidden border-t bg-white p-4 space-y-4">
          <Link href="/admin/dashboard" className="block text-sm font-medium px-4 py-2 hover:bg-muted rounded-md">
            Dashboard
          </Link>
          <Link href="/admin/lawyers" className="block text-sm font-medium px-4 py-2 bg-primary/10 text-primary rounded-md">
            Verifications
          </Link>
          <Link href="/admin/users" className="block text-sm font-medium px-4 py-2 hover:bg-muted rounded-md">
            Users
          </Link>
          <Link href="/admin/cancellation-requests" className="block text-sm font-medium px-4 py-2 hover:bg-muted rounded-md flex items-center justify-between">
            <span>Cancellations</span>
            <CancellationNavBadge count={cancellationCount} />
          </Link>
          <Link href="/admin/security-logs" className="block text-sm font-medium px-4 py-2 hover:bg-muted rounded-md">
            AI Security
          </Link>
          <hr />
          <Button 
            variant="ghost" 
            className="w-full justify-start text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      )}
    </header>
  )
}
