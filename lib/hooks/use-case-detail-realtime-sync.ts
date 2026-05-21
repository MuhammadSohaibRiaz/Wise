"use client"

import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { CASE_DETAIL_CHANGED_EVENT } from "@/lib/case-detail-events"

/**
 * Keeps case detail pages in sync: refetch on Supabase changes, tab focus,
 * and same-tab custom events (e.g. after mark-attended on appointments).
 */
export function useCaseDetailRealtimeSync(
  caseId: string | undefined,
  fetchCaseDetail: (options?: { silent?: boolean }) => Promise<void>,
) {
  const fetchRef = useRef(fetchCaseDetail)
  fetchRef.current = fetchCaseDetail

  useEffect(() => {
    if (!caseId) return

    const supabase = createClient()
    const refresh = () => {
      void fetchRef.current({ silent: true })
    }

    const channel = supabase
      .channel(`case-detail-sync-${caseId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cases", filter: `id=eq.${caseId}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments", filter: `case_id=eq.${caseId}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "case_timeline_events", filter: `case_id=eq.${caseId}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "documents", filter: `case_id=eq.${caseId}` },
        refresh,
      )
      .subscribe()

    const onVisible = () => {
      if (document.visibilityState === "visible") refresh()
    }

    const onCaseChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ caseId?: string }>).detail
      if (detail?.caseId === caseId) refresh()
    }

    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener(CASE_DETAIL_CHANGED_EVENT, onCaseChanged)

    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener(CASE_DETAIL_CHANGED_EVENT, onCaseChanged)
    }
  }, [caseId])
}
