"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"

export function useUnreadMessages() {
  const [unreadCount, setUnreadCount] = useState(0)
  const supabase = createClient()

  const fetchUnreadCount = useCallback(async (userId: string) => {
    try {
      const { count, error } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("recipient_id", userId)
        .eq("is_read", false)

      if (error) throw error
      setUnreadCount(count || 0)
    } catch (err) {
      console.error("[useUnreadMessages] Error fetching count:", err)
    }
  }, [supabase])

  useEffect(() => {
    let activeChannel: any = null
    let isCancelled = false

    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const userId = user.id
      fetchUnreadCount(userId)

      const channelName = `global-unread-${userId}`
      const existing = supabase.getChannels().filter((ch) => ch.topic === `realtime:${channelName}`)
      await Promise.all(existing.map((ch) => supabase.removeChannel(ch)))

      // Subscribe to real-time changes
      const channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `recipient_id=eq.${userId}`,
          },
          () => {
            setUnreadCount((prev) => prev + 1)
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter: `recipient_id=eq.${userId}`,
          },
          (payload) => {
            // If message was marked as read
            if (payload.new.is_read === true && payload.old.is_read === false) {
              setUnreadCount((prev) => Math.max(0, prev - 1))
            }
          }
        )
        .subscribe()

      if (!isCancelled) {
        activeChannel = channel
      } else {
        await supabase.removeChannel(channel)
      }
    }

    setup()

    return () => {
      isCancelled = true
      if (activeChannel) {
        supabase.removeChannel(activeChannel)
      }
    }
  }, [supabase, fetchUnreadCount])

  return unreadCount
}
