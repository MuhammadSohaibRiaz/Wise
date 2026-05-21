"use client"

import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"

const ADMIN_CANCELLATION_REFRESH = "admin-cancellation-refresh"

/** Notify header, dashboard, and cancellation page to refetch queue data. */
export function dispatchAdminCancellationRefresh() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ADMIN_CANCELLATION_REFRESH))
  }
}

type Options = {
  enabled: boolean
  onSync: () => void | Promise<void>
  debounceMs?: number
  /** Called when Realtime subscription fails (e.g. missing RLS script 063). */
  onRealtimeUnavailable?: () => void
}

/**
 * Live-sync admin cancellation queues via Supabase Realtime + focus/visibility.
 * Requires scripts/063_admin_appointments_payments_realtime.sql (admin SELECT + publication).
 */
export function useAdminCancellationSync({
  enabled,
  onSync,
  debounceMs = 300,
  onRealtimeUnavailable,
}: Options) {
  const onSyncRef = useRef(onSync)
  onSyncRef.current = onSync
  const onUnavailableRef = useRef(onRealtimeUnavailable)
  onUnavailableRef.current = onRealtimeUnavailable

  useEffect(() => {
    if (!enabled) return

    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const scheduleSync = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        void onSyncRef.current()
      }, debounceMs)
    }

    const onCustomRefresh = () => scheduleSync()
    window.addEventListener(ADMIN_CANCELLATION_REFRESH, onCustomRefresh)

    const onVisible = () => {
      if (document.visibilityState === "visible") scheduleSync()
    }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onVisible)

    const supabase = createClient()
    const channel = supabase
      .channel(`admin-cancellation-sync-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        (payload) => {
          const row = (payload.new ?? payload.old) as { status?: string } | undefined
          const status = row?.status
          if (
            status === "cancellation_requested" ||
            status === "cancelled" ||
            status === "scheduled" ||
            status === "rescheduled"
          ) {
            scheduleSync()
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "payments" },
        (payload) => {
          const row = payload.new as { status?: string }
          if (row?.status === "refunded" || row?.status === "completed") {
            scheduleSync()
          }
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          onUnavailableRef.current?.()
        }
      })

    const pollInterval = setInterval(() => {
      if (document.visibilityState === "visible") scheduleSync()
    }, 45_000)

    return () => {
      clearInterval(pollInterval)
      if (debounceTimer) clearTimeout(debounceTimer)
      window.removeEventListener(ADMIN_CANCELLATION_REFRESH, onCustomRefresh)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onVisible)
      supabase.removeChannel(channel)
    }
  }, [enabled, debounceMs])
}
