"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Share2, Settings, LogOut, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { NotificationBell } from "@/components/notifications/notification-bell"
import { MessageBadge } from "@/components/notifications/message-badge"
import { formatLawyerRatingLabel, normalizeLawyerAverageRating } from "@/lib/lawyer-rating"

export function LawyerDashboardHeader() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [lawyerProfile, setLawyerProfile] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) return

        const [profileResult, lawyerResult] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", user.id).single(),
          supabase.from("lawyer_profiles").select("*").eq("id", user.id).single(),
        ])

        if (profileResult.data) setProfile(profileResult.data)
        if (lawyerResult.data) setLawyerProfile(lawyerResult.data)
      } catch (error) {
        console.error("Error loading profile:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadProfile()
  }, [supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/")
  }

  const handleProfileSettings = () => {
    router.push("/lawyer/profile")
  }

  const handleShare = async () => {
    if (profile?.id) {
      const url = `${window.location.origin}/client/lawyer/${profile.id}`
      await navigator.clipboard.writeText(url)
      // You could add a toast notification here
    }
  }

  if (isLoading) {
    return (
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4 md:py-6 md:px-6 lg:px-8">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    )
  }

  const fullName = profile
    ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Lawyer"
    : "Lawyer"
  const initials = profile
    ? `${profile.first_name?.charAt(0) || ""}${profile.last_name?.charAt(0) || ""}`.toUpperCase() || "L"
    : "L"
  const location = profile?.location || "Location not set"
  const successRate = lawyerProfile?.success_rate || 0
  const responseTime = lawyerProfile?.response_time_hours || 24
  const rating = normalizeLawyerAverageRating(lawyerProfile?.average_rating)
  const verified = lawyerProfile?.verified || false

  return (
    <div className="border-b bg-card">
      <div className="max-w-7xl mx-auto px-4 py-4 md:py-6 md:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-start md:items-start justify-between gap-4">
          {/* Profile Section */}
          <div className="flex gap-3 md:gap-4 flex-1 w-full">
            <Avatar className="h-16 w-16 md:h-20 md:w-20 border-2 border-primary flex-shrink-0">
              <AvatarImage src={profile?.avatar_url || "/placeholder.svg"} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg md:text-2xl font-bold">{fullName}</h1>
                {verified && (
                  <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 text-xs">Verified</Badge>
                )}
              </div>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">
                📍 {location} • {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>

              {/* Stats */}
              <div className="flex flex-wrap gap-3 md:gap-6 mt-2 md:mt-3">
                <div>
                  <p className="text-xs text-muted-foreground">Success Rate</p>
                  <p className="text-xs md:text-sm font-semibold text-primary">{successRate.toFixed(0)}% Cases Won</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Response Time</p>
                  <p className="text-xs md:text-sm font-semibold">{responseTime}h avg</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Rating</p>
                  <p className="text-xs md:text-sm font-semibold">
                    {rating > 0 ? `${formatLawyerRatingLabel(rating)}/5 ⭐` : "No ratings yet"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons - Removed See Public View */}
          <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">
            <Button size="sm" className="gap-2 text-xs flex-1 md:flex-none" onClick={handleProfileSettings}>
              <Settings className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Profile settings</span>
              <span className="sm:hidden">Settings</span>
            </Button>
            <Button variant="ghost" size="sm" className="flex-shrink-0" onClick={handleShare}>
              <Share2 className="h-3 w-3 md:h-4 md:w-4" />
            </Button>
            <MessageBadge />
            <NotificationBell />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-destructive hover:text-destructive flex-shrink-0"
            >
              <LogOut className="h-3 w-3 md:h-4 md:w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
