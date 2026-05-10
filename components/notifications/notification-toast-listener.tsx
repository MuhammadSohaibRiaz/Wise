"use client"

import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

export function NotificationToastListener() {
  const { toast } = useToast()

  useEffect(() => {
    const supabase = createClient()
    let activeChannel: any = null
    let isCancelled = false

    const setupListener = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) return

      const channelName = `global-notifications-${session.user.id}`
      const existing = supabase.getChannels().filter((ch) => ch.topic === `realtime:${channelName}`)
      await Promise.all(existing.map((ch) => supabase.removeChannel(ch)))

      const channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${session.user.id}`,
          },
          (payload) => {
            const notification = payload.new as any

            toast({
              title: notification.title,
              description: notification.message || notification.description,
              variant: "default",
              className: "bg-primary text-primary-foreground border-none shadow-lg",
            })
          }
        )
        .subscribe()

      if (!isCancelled) {
        activeChannel = channel
      } else {
        await supabase.removeChannel(channel)
      }
    }

    setupListener()

    return () => {
      isCancelled = true
      if (activeChannel) {
        supabase.removeChannel(activeChannel)
      }
    }
  }, [toast])

  return null
}
