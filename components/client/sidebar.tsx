"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  LayoutDashboard,
  Briefcase,
  Brain,
  MessageSquare,
  CreditCard,
  Star,
  Settings,
  ChevronLeft,
  LogOut,
  Gavel,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useUnreadMessages } from "@/hooks/use-unread-messages"
import { Badge } from "@/components/ui/badge"

interface ClientSidebarProps {
  open: boolean
  onToggle: () => void
}

const navItems = [
  { href: "/client/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/client/cases", label: "My Cases", icon: Briefcase },
  { href: "/client/analysis", label: "AI Case Analysis", icon: Brain },
  { href: "/client/judge-simulation", label: "Judicial Perspective", icon: Gavel },
  { href: "/client/messages", label: "Messages", icon: MessageSquare },
  { href: "/client/payments", label: "Payments", icon: CreditCard },
  { href: "/client/reviews", label: "Reviews", icon: Star },
  { href: "/client/settings", label: "Profile Settings", icon: Settings },
]

export function ClientSidebar({ open, onToggle }: ClientSidebarProps) {
  const pathname = usePathname()
  const unreadCount = useUnreadMessages()

  return (
    <>
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed md:relative z-40 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300",
          open ? "w-64" : "-translate-x-full md:translate-x-0 md:w-20",
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
            {open && (
              <Link href="/client/dashboard" className="font-bold text-lg text-sidebar-foreground">
                SmartLaw
              </Link>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className={cn("hidden md:flex", !open && "rotate-180")}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              const isMessages = item.href === "/client/messages"
              
              return (
                <Link key={item.href} href={item.href} onClick={() => {
                  // Close sidebar on mobile when clicking a link
                  if (window.innerWidth < 768) {
                    onToggle()
                  }
                }}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    className={cn(
                      "w-full justify-start relative",
                      isActive && "bg-sidebar-primary text-sidebar-primary-foreground",
                      !open && "md:justify-center",
                    )}
                    title={!open ? item.label : undefined}
                  >
                    <Icon className={cn("h-4 w-4", open && "mr-3")} />
                    {open && <span>{item.label}</span>}
                    
                    {/* Unread Badge */}
                    {isMessages && unreadCount > 0 && (
                      <Badge 
                        className={cn(
                          "bg-red-500 text-white hover:bg-red-600 border-none transition-all",
                          open 
                            ? "ml-auto px-1.5 min-w-[1.25rem] h-5" 
                            : "absolute top-1 right-1 w-2 h-2 p-0 rounded-full"
                        )}
                      >
                        {open ? unreadCount : ""}
                      </Badge>
                    )}
                  </Button>
                </Link>
              )
            })}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-sidebar-border">
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start text-destructive hover:text-destructive",
                !open && "md:justify-center",
              )}
              title={!open ? "Logout" : undefined}
              onClick={async () => {
                const supabase = createClient()
                await supabase.auth.signOut()
                window.location.href = "/"
              }}
            >
              <LogOut className={cn("h-4 w-4", open && "mr-3")} />
              {open && <span>Logout</span>}
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {open && <div className="fixed inset-0 bg-black/50 md:hidden z-30" onClick={onToggle} />}
    </>
  )
}
