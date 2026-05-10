"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { 
  ShieldCheck, 
  Menu, 
  X, 
  LogOut, 
  Users, 
  Briefcase, 
  LayoutDashboard,
  Settings,
  AlertTriangle
} from "lucide-react"
import Link from "next/link"

export function AdminHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()

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
            <Link href="/admin/disputes" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Disputes
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
            
            {/* Mobile menu button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 rounded-md text-muted-foreground hover:bg-muted"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
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
          <Link href="/admin/disputes" className="block text-sm font-medium px-4 py-2 hover:bg-muted rounded-md text-red-600">
            Disputes
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
