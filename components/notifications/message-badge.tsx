"use client"

import { useState, useEffect } from "react"
import { MessageSquare, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

export function MessageBadge() {
  const router = useRouter()
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  const fetchUnreadCount = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) {
        setUnreadCount(0)
        return
      }

      const { count, error } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("recipient_id", session.user.id)
        .eq("is_read", false)

      if (error) throw error
      setUnreadCount(count || 0)
    } catch (error) {
      console.error("[MessageBadge] Error fetching unread count:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchUnreadCount()

    // Set up real-time subscription for new messages
    const setupSubscription = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user?.id) return

        const channel = supabase
          .channel(`unread-messages-${session.user.id}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "messages",
              filter: `recipient_id=eq.${session.user.id}`,
            },
            () => {
              fetchUnreadCount()
            }
          )
          .subscribe()

        return channel
    }

    const channelPromise = setupSubscription()

    return () => {
      channelPromise.then(channel => {
        if (channel) supabase.removeChannel(channel)
      })
    }
  }, [])

  const handleClick = () => {
    // Determine user role and redirect to messages
    const pathname = window.location.pathname
    if (pathname.startsWith("/lawyer")) {
        router.push("/lawyer/messages")
    } else {
        router.push("/client/messages")
    }
  }

  return (
    <button
      className="relative inline-flex items-center justify-center rounded-md p-2 hover:bg-accent hover:text-accent-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      onClick={handleClick}
      title="Messages"
    >
      <MessageSquare className="h-4 w-4" />
      {unreadCount > 0 && (
        <Badge
          variant="destructive"
          className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center p-0 text-[10px] pointer-events-none animate-in zoom-in"
        >
          {unreadCount}
        </Badge>
      )}
    </button>
  )
}
