"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, MessageSquare, Loader2 } from "lucide-react"

interface ActiveCase {
  id: string
  title: string
  status: "open" | "in_progress" | "completed" | "closed"
  hourly_rate: number | null
  description: string | null
  created_at: string
  client: {
    first_name: string | null
    last_name: string | null
  } | null
  message_count?: number
}

const statusConfig: Record<ActiveCase["status"], { label: string; variant: "default" | "secondary" }> = {
  open: { label: "Open", variant: "default" },
  in_progress: { label: "In Progress", variant: "default" },
  completed: { label: "Completed", variant: "secondary" },
  closed: { label: "Closed", variant: "secondary" },
}

interface ActiveCasesProps {
  hideTitle?: boolean
}

export function ActiveCases({ hideTitle = false }: ActiveCasesProps) {
  const [cases, setCases] = useState<ActiveCase[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  const fetchActiveCases = useCallback(async () => {
    try {
      setIsLoading(true)
      const supabase = createClient()

      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session?.user?.id) {
        return
      }

      // Fetch active cases (open or in_progress) where lawyer is assigned
      const { data, error } = await supabase
        .from("cases")
        .select(
          `
          id,
          title,
          description,
          status,
          hourly_rate,
          created_at,
          lawyer_id,
          client:profiles!cases_client_id_fkey (
            first_name,
            last_name
          )
        `,
        )
        .eq("lawyer_id", sessionData.session.user.id)
        .not("lawyer_id", "is", null)
        .in("status", ["open", "in_progress"])
        .order("updated_at", { ascending: false })
        .limit(3)

      if (error) throw error

      // Fetch message counts for each case
      const caseIds = (data || []).map((c: any) => c.id)
      let messageCounts: Record<string, number> = {}

      if (caseIds.length > 0) {
        const { data: messagesData } = await supabase
          .from("messages")
          .select("case_id")
          .in("case_id", caseIds)

        if (messagesData) {
          messagesData.forEach((msg) => {
            messageCounts[msg.case_id] = (messageCounts[msg.case_id] || 0) + 1
          })
        }
      }

      // Map the data
      const mappedCases: ActiveCase[] = (data || []).map((c: any) => ({
        id: c.id,
        title: c.title,
        status: c.status,
        hourly_rate: c.hourly_rate,
        description: c.description,
        created_at: c.created_at,
        client: c.client || null,
        message_count: messageCounts[c.id] || 0,
      }))

      setCases(mappedCases)
    } catch (error) {
      console.error("[v0] ActiveCases fetch error:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchActiveCases()

    const supabase = createClient()
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    const setup = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      if (cancelled || !sessionData.session?.user?.id) return
      const lid = sessionData.session.user.id
      const topic = `lawyer-active-cases-${lid}-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())}`
      channel = supabase
        .channel(topic)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "cases", filter: `lawyer_id=eq.${lid}` },
          () => {
            void fetchActiveCases()
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "messages" },
          () => {
            void fetchActiveCases()
          },
        )
        .subscribe()
    }

    void setup()

    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [fetchActiveCases])

  const getDaysActive = (createdAt: string) => {
    const created = new Date(createdAt)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - created.getTime())
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  if (isLoading) {
    return (
      <div className="space-y-3 md:space-y-4">
        {!hideTitle && (
          <div className="flex items-center justify-between">
            <h2 className="text-xl md:text-2xl font-bold">Active Cases</h2>
            <Button variant="outline" size="sm" className="text-xs md:text-sm bg-transparent" onClick={() => router.push("/lawyer/cases")}>
              View all
            </Button>
          </div>
        )}
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (cases.length === 0) {
    return (
      <div className="space-y-3 md:space-y-4">
        {!hideTitle && (
          <div className="flex items-center justify-between">
            <h2 className="text-xl md:text-2xl font-bold">Active Cases</h2>
            <Button variant="outline" size="sm" className="text-xs md:text-sm bg-transparent" onClick={() => router.push("/lawyer/cases")}>
              View all
            </Button>
          </div>
        )}
        <Card className="p-4 text-center">
          <p className="text-sm text-muted-foreground">No active cases at the moment</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-3 md:space-y-4">
      {!hideTitle && (
        <div className="flex items-center justify-between">
          <h2 className="text-xl md:text-2xl font-bold">Active Cases</h2>
          <Button variant="outline" size="sm" className="text-xs md:text-sm bg-transparent" onClick={() => router.push("/lawyer/cases")}>
            View all
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {cases.map((caseItem) => {
          const statusInfo = statusConfig[caseItem.status]
          const clientName = caseItem.client
            ? `${caseItem.client.first_name || ""} ${caseItem.client.last_name || ""}`.trim() || "Unknown Client"
            : "No client assigned"

          return (
            <Card key={caseItem.id} className="p-3 md:p-4 hover:shadow-md transition-shadow">
              <div className="flex flex-col md:flex-row items-start justify-between gap-3 md:gap-4">
                <div className="flex-1 w-full">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h3 className="font-semibold text-base md:text-lg">{caseItem.title}</h3>
                    <Badge variant={statusInfo.variant} className="text-xs">
                      {statusInfo.label}
                    </Badge>
                  </div>
                  <p className="text-xs md:text-sm text-muted-foreground mb-2">{clientName}</p>
                  {caseItem.description && <p className="text-xs md:text-sm mb-3 line-clamp-2">{caseItem.description}</p>}

                  <div className="flex gap-3 md:gap-4 text-xs text-muted-foreground flex-wrap">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {getDaysActive(caseItem.created_at)} days active
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {caseItem.message_count || 0} messages
                    </div>
                  </div>
                </div>

                <div className="flex md:flex-col items-center md:items-end justify-between md:justify-start w-full md:w-auto gap-3">
                  {caseItem.hourly_rate && (
                    <p className="font-semibold text-primary text-sm md:text-base">${caseItem.hourly_rate}/hr</p>
                  )}
                  <Button
                    size="sm"
                    className="gap-2 text-xs md:text-sm"
                    onClick={() => router.push(`/lawyer/messages?case=${caseItem.id}`)}
                  >
                    <MessageSquare className="h-3 w-3 md:h-4 md:w-4" />
                    Message
                  </Button>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
