"use client"

export const dynamic = "force-dynamic"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, Calendar, FileText, DollarSign, MessageSquare, Star, Loader2 } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { matchLawyersWithCategory } from "@/lib/ai/lawyer-matching"
import { formatDistanceToNow } from "date-fns"
import {
  PendingCaseReviewDialog,
  type PendingReviewCase,
} from "@/components/client/pending-case-review-dialog"
import { formatLawyerRatingLabel, normalizeLawyerAverageRating } from "@/lib/lawyer-rating"

interface DashboardStats {
  activeConsultations: number
  pendingPayments: number
  totalSpent: number
  nextAppointment: {
    date: string
    time: string
    lawyerName: string
  } | null
}

interface NotificationRow {
  id: string
  title: string
  description: string | null
  created_at: string
}

type MatchedLawyer = Awaited<ReturnType<typeof matchLawyersWithCategory>>[number]

export default function ClientDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    activeConsultations: 0,
    pendingPayments: 0,
    totalSpent: 0,
    nextAppointment: null,
  })
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [recommendedLawyers, setRecommendedLawyers] = useState<MatchedLawyer[]>([])
  const [matchHint, setMatchHint] = useState<string | null>(null)
  const [pendingReview, setPendingReview] = useState<PendingReviewCase | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const loadDashboard = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const supabase = createClient()

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user?.id) {
        setError("Authentication required")
        toast({
          title: "Authentication Required",
          description: "Please log in to view your dashboard",
          variant: "destructive",
        })
        return
      }

      const uid = session.user.id

      const { data: casesData } = await supabase
        .from("cases")
        .select("id, status, lawyer_id")
        .eq("client_id", uid)
        .in("status", ["open", "in_progress"])
        .not("lawyer_id", "is", null)

      const activeConsultations = casesData?.length || 0

      const { data: paymentsData } = await supabase
        .from("payments")
        .select("amount, status")
        .eq("client_id", uid)
        .eq("status", "pending")

      const pendingPayments = (paymentsData || []).reduce((sum, p) => sum + p.amount, 0)

      const { data: completedPayments } = await supabase
        .from("payments")
        .select("amount")
        .eq("client_id", uid)
        .eq("status", "completed")

      const totalSpent = (completedPayments || []).reduce((sum, p) => sum + p.amount, 0)

      const { data: appointmentsData } = await supabase
        .from("appointments")
        .select(
          `
          id,
          scheduled_at,
          status,
          lawyer:profiles!appointments_lawyer_id_fkey (
            first_name,
            last_name
          )
        `,
        )
        .eq("client_id", uid)
        .in("status", ["scheduled", "pending", "awaiting_payment"])
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(1)
        .maybeSingle()

      let nextAppointment = null
      if (appointmentsData) {
        const appointmentDate = new Date(appointmentsData.scheduled_at)
        const dayOfWeek = appointmentDate.toLocaleDateString("en-US", { weekday: "long" })
        const time = appointmentDate.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
        const lawyer = appointmentsData.lawyer as { first_name?: string; last_name?: string } | null
        const lawyerName = `${lawyer?.first_name || ""} ${lawyer?.last_name || ""}`.trim()

        nextAppointment = {
          date: dayOfWeek,
          time: time,
          lawyerName: lawyerName || "Lawyer",
        }
      }

      setStats({
        activeConsultations,
        pendingPayments,
        totalSpent,
        nextAppointment,
      })

      const { data: notifRows } = await supabase
        .from("notifications")
        .select("id, title, description, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(12)

      setNotifications((notifRows as NotificationRow[]) || [])

      const { data: docs } = await supabase
        .from("documents")
        .select(
          `
          id,
          created_at,
          document_analysis (
            summary,
            analysis_status
          )
        `,
        )
        .eq("uploaded_by", uid)
        .order("created_at", { ascending: false })
        .limit(15)

      let hint: string | null = null
      for (const row of docs || []) {
        const da = row.document_analysis as
          | { summary?: string; analysis_status?: string }
          | { summary?: string; analysis_status?: string }[]
          | null
        const analysis = Array.isArray(da) ? da[0] : da
        if (analysis?.analysis_status === "completed" && analysis.summary?.trim()) {
          hint = analysis.summary.trim()
          break
        }
      }

      setMatchHint(hint)
      if (hint) {
        const matched = await matchLawyersWithCategory(supabase, hint)
        setRecommendedLawyers(matched.slice(0, 6))
      } else {
        setRecommendedLawyers([])
      }

      const { data: completedCases } = await supabase
        .from("cases")
        .select("id, title, lawyer_id")
        .eq("client_id", uid)
        .eq("status", "completed")
        .order("updated_at", { ascending: false })
        .limit(20)

      if (completedCases && completedCases.length > 0) {
        const caseIds = completedCases.map((c) => c.id)
        const { data: existingReviews } = await supabase
          .from("reviews")
          .select("case_id")
          .eq("reviewer_id", uid)
          .in("case_id", caseIds)

        const reviewed = new Set((existingReviews || []).map((r) => r.case_id))
        const nextCase = completedCases.find((c) => c.lawyer_id && !reviewed.has(c.id))
        if (nextCase?.lawyer_id) {
          const { data: lawyerRow } = await supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("id", nextCase.lawyer_id)
            .maybeSingle()
          const lawyerName =
            `${lawyerRow?.first_name || ""} ${lawyerRow?.last_name || ""}`.trim() || "Your lawyer"
          setPendingReview({
            id: nextCase.id,
            title: nextCase.title || "Case",
            lawyerId: nextCase.lawyer_id,
            lawyerName,
          })
          setReviewOpen(true)
        } else {
          setPendingReview(null)
        }
      } else {
        setPendingReview(null)
      }
    } catch (err: unknown) {
      console.error("[Client Dashboard] Error fetching data:", err)
      setError(err instanceof Error ? err.message : "Failed to load dashboard data")
      toast({
        title: "Error",
        description: "Failed to load dashboard data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    const setup = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user?.id || cancelled) return

      const uid = session.user.id
      const topic = `dashboard-sync-${uid}-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())}`

      channel = supabase
        .channel(topic)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${uid}`,
          },
          () => {
            void loadDashboard()
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "cases", filter: `client_id=eq.${uid}` },
          () => {
            void loadDashboard()
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "appointments", filter: `client_id=eq.${uid}` },
          () => {
            void loadDashboard()
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "payments", filter: `client_id=eq.${uid}` },
          () => {
            void loadDashboard()
          },
        )
        .subscribe()
    }

    void setup()
    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [loadDashboard])

  if (error) {
    return (
      <main className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <div className="text-center">
          <h2 className="text-xl font-semibold text-destructive mb-2">Error Loading Dashboard</h2>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Try Again
          </Button>
        </div>
      </main>
    )
  }

  if (isLoading) {
    return (
      <main className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </main>
    )
  }

  return (
    <main className="space-y-8">
      <PendingCaseReviewDialog
        pending={pendingReview}
        open={reviewOpen && !!pendingReview}
        onOpenChange={setReviewOpen}
        onSubmitted={() => void loadDashboard()}
      />

      {/* Summary Cards */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/client/cases">
          <Card className="cursor-pointer hover:bg-accent transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Consultations</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeConsultations}</div>
              <p className="text-xs text-muted-foreground">Ongoing cases</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/client/payments">
          <Card className="cursor-pointer hover:bg-accent transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.pendingPayments.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Due now</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/client/appointments">
          <Card className="cursor-pointer hover:bg-accent transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Next Appointment</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {stats.nextAppointment ? (
                <>
                  <div className="text-2xl font-bold">{stats.nextAppointment.date}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats.nextAppointment.time} with {stats.nextAppointment.lawyerName}
                  </p>
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold">None</div>
                  <p className="text-xs text-muted-foreground">No upcoming appointments</p>
                </>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link href="/client/payments">
          <Card className="cursor-pointer hover:bg-accent transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalSpent.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>
        </Link>
      </section>

      {/* Quick Actions */}
      <section className="grid gap-4 md:grid-cols-3">
        <Link href="/client/analysis">
          <Card className="border-2 border-primary/20 hover:border-primary/40 transition-colors cursor-pointer min-h-[180px] flex flex-col">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Upload Document
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col">
              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">Get AI analysis of your legal documents</p>
              <Button variant="outline" size="sm" className="mt-auto">
                Upload Now
              </Button>
            </CardContent>
          </Card>
        </Link>

        <Link href="/match">
          <Card className="border-2 border-primary/20 hover:border-primary/40 transition-colors cursor-pointer min-h-[180px] flex flex-col">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Star className="h-5 w-5 text-primary" />
                Find a Lawyer
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col">
              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">Browse verified lawyers in your area</p>
              <Button variant="outline" size="sm" className="mt-auto">
                Browse Now
              </Button>
            </CardContent>
          </Card>
        </Link>

        {/* AI Recommendations card hidden — page still accessible at /client/ai-recommendations */}
      </section>

      {/* Recommended Lawyers */}
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold">Recommended Lawyers</h2>
          <p className="text-muted-foreground">
            {matchHint
              ? "Based on your latest document analysis summary — updates when you run a new analysis."
              : "Upload and analyze a document to get matched lawyers for your situation."}
          </p>
        </div>

        {recommendedLawyers.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center text-muted-foreground">
              <p className="font-medium text-foreground mb-1">No lawyer matches yet</p>
              <p className="text-sm max-w-lg mx-auto">
                We could not match specialists from your history yet. Try{" "}
                <Link href="/client/analysis" className="text-primary underline">
                  analyzing a document
                </Link>{" "}
                to get matched with the right lawyer.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {recommendedLawyers.map((lawyer) => {
              const matchPct = Math.min(99, Math.round(Number(lawyer.match_score) || 0))
              const spec =
                Array.isArray(lawyer.specializations) && lawyer.specializations.length > 0
                  ? lawyer.specializations.slice(0, 2).join(", ")
                  : "Legal practice"
              return (
                <Card key={lawyer.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">{lawyer.name}</CardTitle>
                        <CardDescription className="line-clamp-2">{spec}</CardDescription>
                      </div>
                      <Badge variant="secondary">{matchPct}% match</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{lawyer.location || "Location not set"}</span>
                      <span className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        {normalizeLawyerAverageRating(lawyer.rating) > 0
                          ? `${formatLawyerRatingLabel(normalizeLawyerAverageRating(lawyer.rating))}/5`
                          : "New"}
                      </span>
                    </div>
                    <Button className="w-full" asChild>
                      <Link href={`/client/lawyer/${lawyer.id}`}>View profile</Link>
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* Recent Notifications */}
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold">Recent Notifications</h2>
          <p className="text-sm text-muted-foreground">Synced live from your account activity</p>
        </div>

        {notifications.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              No notifications yet — appointments, payments, and case updates will appear here.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {notifications.map((notif) => (
              <Card key={notif.id} className="border-l-4 border-l-primary">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium">{notif.title}</p>
                      {notif.description ? (
                        <p className="text-sm text-muted-foreground mt-1">{notif.description}</p>
                      ) : null}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
