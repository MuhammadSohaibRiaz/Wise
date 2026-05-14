"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, Eye, Star, Loader2, AlertCircle, Briefcase, Calendar } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
// import { getOpenDisputeCaseIds } from "@/lib/case-disputes"

interface Case {
  id: string
  title: string
  description: string | null
  status: "open" | "in_progress" | "pending_completion" | "completed" | "closed"
  case_type: string | null
  hourly_rate: number | null
  created_at: string
  updated_at: string
  lawyer: {
    id: string
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
  } | null
  next_appointment?: {
    id: string
    scheduled_at: string
    status: string
  } | null
  total_payments?: number
}

const statusConfig: Record<Case["status"], { label: string; className: string }> = {
  open: {
    label: "Open",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800",
  },
  in_progress: {
    label: "In Progress",
    className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border border-orange-200 dark:border-orange-800",
  },
  pending_completion: {
    label: "Completion Requested",
    className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200 dark:border-purple-800",
  },
  completed: {
    label: "Completed",
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-800",
  },
  closed: {
    label: "Closed",
    className: "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400 border border-gray-200 dark:border-gray-700",
  },
}

export default function MyCasesPage() {
  const [cases, setCases] = useState<Case[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clientId, setClientId] = useState<string | null>(null)
  // const [openDisputeCaseIds, setOpenDisputeCaseIds] = useState<Set<string>>(() => new Set())
  const { toast } = useToast()
  const router = useRouter()
  const toastRef = useRef(toast)
  toastRef.current = toast

  const fetchCases = useCallback(async () => {
    try {
      setIsLoading(true)
      const supabase = createClient()

      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session?.user?.id) {
        setError("Not authenticated")
        return
      }
      setClientId(sessionData.session.user.id)

      // Fetch cases with lawyer info and next appointment
      const { data, error: fetchError } = await supabase
        .from("cases")
        .select(
          `
          id,
          title,
          description,
          status,
          case_type,
          hourly_rate,
          created_at,
          updated_at,
          lawyer_id,
          lawyer:profiles!cases_lawyer_id_fkey (
            id,
            first_name,
            last_name,
            avatar_url
          )
        `,
        )
        .eq("client_id", sessionData.session.user.id)
        .neq("title", "AI Analysis Documents")
        .order("updated_at", { ascending: false })

      if (fetchError) throw fetchError

      // Fetch next appointments for each case
      const caseIds = (data || []).map((c: any) => c.id)
      let appointmentsMap: Record<string, any> = {}

      if (caseIds.length > 0) {
        const { data: appointmentsData } = await supabase
          .from("appointments")
          .select("id, case_id, scheduled_at, status")
          .in("case_id", caseIds)
          .in("status", ["pending", "scheduled", "awaiting_payment", "rescheduled", "cancellation_requested"])
          .order("scheduled_at", { ascending: true })

        if (appointmentsData) {
          appointmentsData.forEach((apt) => {
            if (!appointmentsMap[apt.case_id]) {
              appointmentsMap[apt.case_id] = apt
            }
          })
        }
      }

      // Fetch total payments for each case
      let paymentsMap: Record<string, number> = {}
      if (caseIds.length > 0) {
        const { data: paymentsData } = await supabase
          .from("payments")
          .select("case_id, amount, status")
          .in("case_id", caseIds)
          .eq("status", "completed")

        if (paymentsData) {
          paymentsData.forEach((payment) => {
            paymentsMap[payment.case_id] = (paymentsMap[payment.case_id] || 0) + Number(payment.amount)
          })
        }
      }

      // Map the data
      const mappedCases: Case[] = (data || []).map((c: any) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        status: c.status,
        case_type: c.case_type,
        hourly_rate: c.hourly_rate,
        created_at: c.created_at,
        updated_at: c.updated_at,
        lawyer: c.lawyer || null,
        next_appointment: appointmentsMap[c.id] || null,
        total_payments: paymentsMap[c.id] || 0,
      }))

      setCases(mappedCases)
      // Dispute badges disabled for now
      // const disputeSet = await getOpenDisputeCaseIds(supabase, caseIds)
      // setOpenDisputeCaseIds(disputeSet)
      setError(null)
    } catch (error) {
      console.error("[v0] Fetch error:", error)
      setError("Failed to load cases")
      toastRef.current({
        title: "Error",
        description: "Failed to load your cases.",
        variant: "destructive",
        duration: 10_000,
      })
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCases()
  }, [fetchCases])

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    const run = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      if (cancelled || !sessionData.session?.user?.id) return

      const uid = sessionData.session.user.id
      const topic = `cases-updates-${uid}-${crypto.randomUUID?.() ?? String(Date.now())}`

      channel = supabase
        .channel(topic)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "cases",
            filter: `client_id=eq.${uid}`,
          },
          () => {
            void fetchCases()
          },
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "appointments",
            filter: `client_id=eq.${uid}`,
          },
          () => {
            void fetchCases()
          },
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "payments",
            filter: `client_id=eq.${uid}`,
          },
          () => {
            void fetchCases()
          },
        )
        .subscribe()
    }

    void run()

    return () => {
      cancelled = true
      if (channel) {
        supabase.removeChannel(channel)
        channel = null
      }
    }
  }, [fetchCases])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return "Today"
    if (diffDays === 1) return "Yesterday"
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    return `${Math.floor(diffDays / 30)} months ago`
  }

  if (isLoading) {
    return (
      <main className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">My Cases</h1>
          <p className="text-muted-foreground mt-2">Track your ongoing and past legal consultations</p>
        </div>
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </main>
    )
  }

  if (error && cases.length === 0) {
    return (
      <main className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">My Cases</h1>
          <p className="text-muted-foreground mt-2">Track your ongoing and past legal consultations</p>
        </div>
        <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
          <div>
            <h2 className="font-semibold text-red-900">Error</h2>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="space-y-8">
      {/* Header with View All Appointments Button */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">My Cases</h1>
          <p className="text-muted-foreground mt-2">Manage your ongoing legal cases</p>
        </div>
        <Link href="/client/appointments">
          <Button className="gap-2">
            <Calendar className="h-4 w-4" />
            View All Appointments
          </Button>
        </Link>
      </div>

      {cases.length > 0 && (
        <p className="text-sm text-muted-foreground rounded-lg border border-border bg-muted/30 px-4 py-3">
          <span className="font-medium text-foreground">How cases work:</span> A case is created when you book a
          consultation with a lawyer. <strong>Open</strong> means the consultation is pending or scheduled.
          When your lawyer requests case completion, open <strong>View</strong> on that case to{" "}
          <strong>confirm</strong> or <strong>decline</strong>.
        </p>
      )}

      {cases.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <Briefcase className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <h3 className="mt-4 font-semibold">No cases yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">Book an appointment to create your first case</p>
          <a href="/match" className="mt-4 inline-block">
            <Button>Find a Lawyer</Button>
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {cases.map((caseItem) => {
            const statusInfo = statusConfig[caseItem.status] ?? statusConfig.in_progress
            const lawyerName = caseItem.lawyer
              ? `${caseItem.lawyer.first_name || ""} ${caseItem.lawyer.last_name || ""}`.trim() || "Unknown Lawyer"
              : "No lawyer assigned"

            return (
              <Card key={caseItem.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="grid gap-4 md:grid-cols-5 items-center">
                    <div className="md:col-span-2">
                      <h3 className="font-semibold">{caseItem.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">with {lawyerName}</p>
                      {caseItem.case_type && (
                        <p className="text-xs text-muted-foreground mt-1">Type: {caseItem.case_type}</p>
                      )}
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">Status</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">Last Update</p>
                      <p className="text-sm">{formatDate(caseItem.updated_at)}</p>
                      {caseItem.next_appointment && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Next: {new Date(caseItem.next_appointment.scheduled_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2 justify-end flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/client/cases/${caseItem.id}`)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/client/messages?case=${caseItem.id}`)}
                      >
                        <MessageSquare className="h-4 w-4 mr-1" />
                        Message
                      </Button>
                      {caseItem.status === "completed" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/client/reviews?case=${caseItem.id}`)}
                        >
                          <Star className="h-4 w-4 mr-1" />
                          Review
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </main>
  )
}
