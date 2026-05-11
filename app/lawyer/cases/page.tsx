"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Loader2, AlertCircle, Briefcase, MessageSquare, Eye, Calendar, User, FileText } from "lucide-react"
import { LawyerDashboardHeader } from "@/components/lawyer/dashboard-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  client: {
    id: string
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
    email: string | null
  } | null
  next_appointment?: {
    id: string
    scheduled_at: string
    status: string
  } | null
  appointment_count?: number
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

export default function LawyerCasesPage() {
  const [cases, setCases] = useState<Case[]>([])
  const [filteredCases, setFilteredCases] = useState<Case[]>([])
  const [activeFilter, setActiveFilter] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lawyerId, setLawyerId] = useState<string | null>(null)
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

      setLawyerId(sessionData.session.user.id)

      // Fetch cases with client info
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
          client_id,
          client:profiles!cases_client_id_fkey (
            id,
            first_name,
            last_name,
            avatar_url,
            email
          )
        `,
        )
        .eq("lawyer_id", sessionData.session.user.id)
        .order("updated_at", { ascending: false })

      if (fetchError) throw fetchError

      // Fetch appointments for each case
      const caseIds = (data || []).map((c: any) => c.id)
      let appointmentsMap: Record<string, any> = {}
      let appointmentCounts: Record<string, number> = {}

      if (caseIds.length > 0) {
        const { data: appointmentsData } = await supabase
          .from("appointments")
          .select("id, case_id, scheduled_at, status")
          .in("case_id", caseIds)
          .order("scheduled_at", { ascending: true })

        if (appointmentsData) {
          appointmentsData.forEach((apt) => {
            if (!appointmentsMap[apt.case_id] && apt.status === "scheduled") {
              appointmentsMap[apt.case_id] = apt
            }
            appointmentCounts[apt.case_id] = (appointmentCounts[apt.case_id] || 0) + 1
          })
        }
      }

      // Map the data
      const mappedCases: Case[] = (data || []).map((c: any) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        status: c.status as Case["status"],
        case_type: c.case_type,
        hourly_rate: c.hourly_rate,
        created_at: c.created_at,
        updated_at: c.updated_at,
        client: c.client || null,
        next_appointment: appointmentsMap[c.id] || null,
        appointment_count: appointmentCounts[c.id] || 0,
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
      const topic = `lawyer-cases-updates-${uid}-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())}`

      channel = supabase
        .channel(topic)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "cases",
            filter: `lawyer_id=eq.${uid}`,
          },
          () => {
            void fetchCases()
          },
        )
        // Dispute realtime disabled for now
        // .on(
        //   "postgres_changes",
        //   { event: "*", schema: "public", table: "case_disputes" },
        //   () => { void fetchCases() },
        // )
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

  useEffect(() => {
    if (activeFilter === "all") {
      setFilteredCases(cases)
    } else if (activeFilter === "in_progress") {
      setFilteredCases(cases.filter((c) => c.status === "in_progress" || c.status === "pending_completion"))
    } else {
      setFilteredCases(cases.filter((c) => c.status === activeFilter))
    }
  }, [cases, activeFilter])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <LawyerDashboardHeader />
        <div className="px-4 py-4 md:px-6 md:py-6 lg:px-8 max-w-7xl mx-auto">
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    )
  }

  if (error && cases.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <LawyerDashboardHeader />
        <div className="px-4 py-4 md:px-6 md:py-6 lg:px-8 max-w-7xl mx-auto">
          <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
            <div>
              <h2 className="font-semibold text-red-900">Error</h2>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <LawyerDashboardHeader />

      <div className="px-4 py-4 md:px-6 md:py-6 lg:px-8 max-w-7xl mx-auto">
          <main className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold">My Cases</h1>
              <p className="text-muted-foreground mt-2">Manage all your legal cases and consultations</p>
              <p className="text-sm text-muted-foreground mt-3 max-w-2xl">
                To close a matter with the client: open a case → <strong>View Details</strong> → use{" "}
                <strong>Request completion</strong> (client then confirms, declines, or opens a dispute from their case page).
              </p>
            </div>

            <Tabs value={activeFilter} onValueChange={setActiveFilter} className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="all">All ({cases.length})</TabsTrigger>
                <TabsTrigger value="open">Open ({cases.filter((c) => c.status === "open").length})</TabsTrigger>
                <TabsTrigger value="in_progress">
                  In Progress (
                  {cases.filter((c) => c.status === "in_progress" || c.status === "pending_completion").length})
                </TabsTrigger>
                <TabsTrigger value="completed">
                  Completed ({cases.filter((c) => c.status === "completed").length})
                </TabsTrigger>
                <TabsTrigger value="closed">
                  Closed ({cases.filter((c) => c.status === "closed").length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value={activeFilter} className="mt-6">
                {filteredCases.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
                    <Briefcase className="mx-auto h-12 w-12 text-muted-foreground/40" />
                    <h3 className="mt-4 font-semibold">No cases found</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {activeFilter === "all"
                        ? "You don't have any cases yet"
                        : `You don't have any ${activeFilter.replace("_", " ")} cases`}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredCases.map((caseItem) => {
                      const statusInfo = statusConfig[caseItem.status] ?? statusConfig.in_progress
                      const clientName = caseItem.client
                        ? `${caseItem.client.first_name || ""} ${caseItem.client.last_name || ""}`.trim() || "Unknown Client"
                        : "No client assigned"

                      return (
                        <Card key={caseItem.id} className="hover:shadow-md transition-shadow">
                          <div className="p-6">
                            <div className="flex items-start justify-between gap-4 mb-4">
                              <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-3 mb-2">
                                  <h3 className="text-xl font-semibold">{caseItem.title}</h3>
                                  <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
                                  {/* Dispute badge disabled for now */}
                                </div>
                                {caseItem.case_type && (
                                  <p className="text-sm text-muted-foreground mb-2">Type: {caseItem.case_type}</p>
                                )}
                                {caseItem.description && (
                                  <p className="text-sm text-muted-foreground line-clamp-2">{caseItem.description}</p>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="text-xs text-muted-foreground">Client</p>
                                  <p className="text-sm font-medium">{clientName}</p>
                                </div>
                              </div>

                              {caseItem.hourly_rate && (
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-muted-foreground" />
                                  <div>
                                    <p className="text-xs text-muted-foreground">Hourly Rate</p>
                                    <p className="text-sm font-medium">${caseItem.hourly_rate}/hr</p>
                                  </div>
                                </div>
                              )}

                              {caseItem.next_appointment && (
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  <div>
                                    <p className="text-xs text-muted-foreground">Next Appointment</p>
                                    <p className="text-sm font-medium">
                                      {new Date(caseItem.next_appointment.scheduled_at).toLocaleDateString()}
                                    </p>
                                  </div>
                                </div>
                              )}

                              <div className="flex items-center gap-2">
                                <Briefcase className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="text-xs text-muted-foreground">Appointments</p>
                                  <p className="text-sm font-medium">{caseItem.appointment_count || 0}</p>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t">
                              <div className="text-xs text-muted-foreground">
                                Updated: {formatDate(caseItem.updated_at)}
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => router.push(`/lawyer/cases/${caseItem.id}`)}
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  View Details
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => router.push(`/lawyer/messages?case=${caseItem.id}`)}
                                >
                                  <MessageSquare className="h-4 w-4 mr-1" />
                                  Message
                                </Button>
                              </div>
                            </div>
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </main>
      </div>
    </div>
  )
}

