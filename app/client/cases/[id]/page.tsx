"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Loader2,
  AlertCircle,
  Calendar,
  MessageSquare,
  FileText,
  User,
  ArrowLeft,
  Clock,
  DollarSign,
  Briefcase,
  CheckCircle2,
  Star,
  XCircle,
  LayoutDashboard,
  History,
} from "lucide-react"
import { ReviewModal } from "@/components/client/review-modal"
// import { DisputeModal } from "@/components/cases/dispute-modal"
import { createNotification } from "@/lib/notifications"
import { appointmentDisplayLabel } from "@/lib/appointment-display"
import { deriveCaseLifecycleStages } from "@/lib/case-lifecycle-stages"
import { CaseProgressStepper } from "@/components/cases/case-progress-stepper"
import { CaseActivityFeed } from "@/components/cases/case-activity-feed"

interface CaseDetail {
  id: string
  title: string
  description: string | null
  status: "open" | "in_progress" | "pending_completion" | "completed" | "closed"
  case_type: string | null
  hourly_rate: number | null
  budget_min: number | null
  budget_max: number | null
  created_at: string
  updated_at: string
  lawyer: {
    id: string
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
    email: string | null
  } | null
}

interface Appointment {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  notes: string | null
}

interface Document {
  id: string
  file_name: string
  file_url: string
  file_type: string | null
  document_type: string | null
  status: string
  created_at: string
  uploaded_by: string
  uploader?: {
    first_name: string | null
    last_name: string | null
    user_type: string | null
  } | null
}

interface CaseTimelineEventRow {
  id: string
  event_type: string
  created_at: string
  metadata: Record<string, unknown> | null
}

const statusConfig: Record<CaseDetail["status"], { label: string; className: string }> = {
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

export default function ClientCaseDetailPage() {
  const params = useParams()
  const caseId = params.id as string
  const router = useRouter()
  const { toast } = useToast()

  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [timelineEvents, setTimelineEvents] = useState<CaseTimelineEventRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isConfirming, setIsConfirming] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [hasReviewed, setHasReviewed] = useState(false)
  // const [showDisputeModal, setShowDisputeModal] = useState(false)
  const [clientId, setClientId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [caseTab, setCaseTab] = useState("overview")

  const fetchCaseDetail = useCallback(async () => {
    try {
      setIsLoading(true)
      const supabase = createClient()

      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session?.user?.id) {
        setError("Not authenticated")
        return
      }

      setClientId(sessionData.session.user.id)

      // Fetch case with lawyer info
      const { data: caseData, error: caseError } = await supabase
        .from("cases")
        .select(
          `
          id,
          title,
          description,
          status,
          case_type,
          hourly_rate,
          budget_min,
          budget_max,
          created_at,
          updated_at,
          lawyer_id,
          lawyer:profiles!cases_lawyer_id_fkey (
            id,
            first_name,
            last_name,
            avatar_url,
            email
          )
        `,
        )
        .eq("id", caseId)
        .eq("client_id", sessionData.session.user.id)
        .single()

      if (caseError) throw caseError
      if (!caseData) {
        setError("Case not found")
        return
      }

      setCaseDetail({
        id: caseData.id,
        title: caseData.title,
        description: caseData.description,
        status: caseData.status,
        case_type: caseData.case_type,
        hourly_rate: caseData.hourly_rate,
        budget_min: caseData.budget_min,
        budget_max: caseData.budget_max,
        created_at: caseData.created_at,
        updated_at: caseData.updated_at,
        lawyer: caseData.lawyer || null,
      })

      // Fetch appointments
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from("appointments")
        .select("id, scheduled_at, duration_minutes, status, notes")
        .eq("case_id", caseId)
        .order("scheduled_at", { ascending: false })

      if (appointmentsError) throw appointmentsError
      setAppointments(appointmentsData || [])

      // Fetch documents with uploader info
      const { data: documentsData, error: documentsError } = await supabase
        .from("documents")
        .select(`
          id, file_name, file_url, file_type, document_type, status, created_at, uploaded_by,
          uploader:profiles!documents_uploaded_by_fkey (
            first_name, last_name, user_type
          )
        `)
        .eq("case_id", caseId)
        .order("created_at", { ascending: false })

      if (documentsError) throw documentsError
      setDocuments(documentsData || [])

      const { data: timelineData, error: timelineError } = await supabase
        .from("case_timeline_events")
        .select("id, event_type, metadata, created_at")
        .eq("case_id", caseId)
        .order("created_at", { ascending: true })

      if (timelineError) throw timelineError
      setTimelineEvents((timelineData as CaseTimelineEventRow[]) || [])

      // Check if client already left a review for this case
      const { data: existingReview } = await supabase
        .from("reviews")
        .select("id")
        .eq("case_id", caseId)
        .eq("reviewer_id", sessionData.session.user.id)
        .limit(1)
        .maybeSingle()

      setHasReviewed(!!existingReview)

      setError(null)
    } catch (error) {
      console.error("[v0] Fetch error:", error)
      setError("Failed to load case details")
      toast({
        title: "Error",
        description: "Failed to load case details.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [caseId, toast])

  useEffect(() => {
    if (caseId) {
      fetchCaseDetail()
    }
  }, [caseId, fetchCaseDetail])

  useEffect(() => {
    if (!caseId) return
    const supabase = createClient()
    const topic = `client-case-detail-${caseId}-${Date.now()}`
    const channel = supabase
      .channel(topic)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cases", filter: `id=eq.${caseId}` },
        () => { void fetchCaseDetail() },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments", filter: `case_id=eq.${caseId}` },
        () => { void fetchCaseDetail() },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "documents", filter: `case_id=eq.${caseId}` },
        () => { void fetchCaseDetail() },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "case_timeline_events", filter: `case_id=eq.${caseId}` },
        () => { void fetchCaseDetail() },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [caseId, fetchCaseDetail])

  const handleConfirmCompletion = async () => {
    if (!caseDetail) return

    try {
      setIsConfirming(true)
      const supabase = createClient()

      const { error } = await supabase
        .from("cases")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", caseId)

      if (error) throw error

      if (caseDetail.lawyer?.id) {
        await createNotification(supabase, {
          user_id: caseDetail.lawyer.id,
          type: "case_update",
          title: "Case Completed",
          description: `Client confirmed completion for "${caseDetail.title}".`,
          data: { case_id: caseId, status: "completed" },
        })
      }

      setCaseDetail({ ...caseDetail, status: "completed", updated_at: new Date().toISOString() })
      
      toast({
        title: "Case Completed",
        description: "You can now leave a review for your lawyer.",
      })

      // Show review modal after a short delay (only if not already reviewed)
      if (!hasReviewed) {
        setTimeout(() => {
          setShowReviewModal(true)
        }, 500)
      }

    } catch (error) {
      console.error("Error confirming completion:", error)
      toast({
        title: "Error",
        description: "Failed to confirm completion. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsConfirming(false)
    }
  }

  // Dispute disabled for now
  // const handleRaiseDispute = () => {
  //   setShowDisputeModal(true)
  // }

  const handleDeclineCompletion = async () => {
    if (!caseDetail) return

    try {
      setIsConfirming(true)
      const supabase = createClient()

      const { error } = await supabase
        .from("cases")
        .update({ status: "in_progress", updated_at: new Date().toISOString() })
        .eq("id", caseId)

      if (error) throw error

      if (caseDetail.lawyer?.id) {
        await createNotification(supabase, {
          user_id: caseDetail.lawyer.id,
          type: "case_update",
          title: "Client declined completion request",
          description: `The client is not ready to close "${caseDetail.title}" yet. The case is back in progress.`,
          data: { case_id: caseId, status: "in_progress", previous_status: "pending_completion" },
        })
      }

      setCaseDetail({ ...caseDetail, status: "in_progress", updated_at: new Date().toISOString() })

      toast({
        title: "Request declined",
        description: "The case stays in progress. You can raise a dispute if there is a serious issue.",
      })
    } catch (error) {
      console.error("Error declining completion:", error)
      toast({
        title: "Error",
        description: "Could not update the case. If you just added DB columns, run script 039 in Supabase first.",
        variant: "destructive",
      })
    } finally {
      setIsConfirming(false)
    }
  }

  if (isLoading) {
    return (
      <main className="space-y-8">
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </main>
    )
  }

  if (error || !caseDetail) {
    return (
      <main className="space-y-8">
        <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
          <div>
            <h2 className="font-semibold text-red-900">Error</h2>
            <p className="text-sm text-red-700">{error || "Case not found"}</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => router.push("/client/cases")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Cases
        </Button>
      </main>
    )
  }

  const statusInfo = statusConfig[caseDetail.status] ?? statusConfig.in_progress
  const lawyerName = caseDetail.lawyer
    ? `${caseDetail.lawyer.first_name || ""} ${caseDetail.lawyer.last_name || ""}`.trim() || "Unknown Lawyer"
    : "No lawyer assigned"

  return (
    <main className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" onClick={() => router.push("/client/cases")} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Cases
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{caseDetail.title}</h1>
            <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
          </div>
          {caseDetail.case_type && <p className="text-muted-foreground mt-2">Type: {caseDetail.case_type}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/client/messages?case=${caseDetail.id}`)}>
            <MessageSquare className="h-4 w-4 mr-2" />
            Message
          </Button>
        </div>
      </div>

      {caseDetail.status === "pending_completion" && (
        <Card className="border-purple-200 bg-purple-50 dark:bg-purple-950/20 border-2 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/50 rounded-full">
                <CheckCircle2 className="h-8 w-8 text-purple-700 dark:text-purple-400" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-xl font-bold text-purple-900 dark:text-purple-300">
                  Lawyer has requested case completion
                </h2>
                <p className="text-purple-700 dark:text-purple-400 mt-1">
                  Please review the work done. If satisfied, confirm completion — you&apos;ll then be able to leave a review.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <Button
                  variant="outline"
                  className="flex-1 border-purple-300 text-purple-700 hover:bg-purple-100"
                  onClick={handleDeclineCompletion}
                  disabled={isConfirming}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Decline
                </Button>
                <Button 
                  className="flex-1 bg-purple-700 hover:bg-purple-800 text-white"
                  onClick={handleConfirmCompletion}
                  disabled={isConfirming}
                >
                  {isConfirming ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Confirm Completion
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {caseDetail.status === "completed" && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 border-2">
          <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
              <div>
                <p className="font-semibold text-green-900 dark:text-green-400">
                  Case completed successfully
                </p>
                <p className="text-sm text-green-700 dark:text-green-500">
                  {hasReviewed
                    ? "Thank you for leaving a review!"
                    : "Please rate your experience with the lawyer to help other clients."}
                </p>
              </div>
            </div>
            {!hasReviewed && (
              <Button onClick={() => setShowReviewModal(true)} className="shrink-0">
                <Star className="h-4 w-4 mr-2 text-yellow-500 fill-yellow-500" />
                Leave a Review
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Workflow Progress Stepper */}
      <Card>
        <CardContent className="pt-6 pb-4">
          <CaseProgressStepper
            stages={deriveCaseLifecycleStages({
              caseStatus: caseDetail.status,
              appointments,
              timelineEventTypes: timelineEvents.map((e) => e.event_type),
            })}
          />
        </CardContent>
      </Card>

      <Tabs value={caseTab} onValueChange={setCaseTab} className="space-y-6">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/40 p-1">
          <TabsTrigger value="overview" className="gap-1.5">
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="timeline" className="gap-1.5">
            <History className="h-4 w-4 shrink-0" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-1.5">
            <FileText className="h-4 w-4 shrink-0" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="appointments" className="gap-1.5">
            <Calendar className="h-4 w-4 shrink-0" />
            Appointments
          </TabsTrigger>
          <TabsTrigger value="messages" className="gap-1.5">
            <MessageSquare className="h-4 w-4 shrink-0" />
            Messages
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-0">
          <Card className="max-w-3xl">
            <CardHeader>
              <CardTitle>Case Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {caseDetail.description && (
                <div>
                  <p className="text-sm font-medium mb-1">Description</p>
                  <p className="text-sm text-muted-foreground">{caseDetail.description}</p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Lawyer</p>
                  <p className="text-sm font-medium">{lawyerName}</p>
                </div>
              </div>

              {caseDetail.hourly_rate && (
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Hourly Rate</p>
                    <p className="text-sm font-medium">${caseDetail.hourly_rate}/hr</p>
                  </div>
                </div>
              )}

              {(caseDetail.budget_min || caseDetail.budget_max) && (
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Budget</p>
                    <p className="text-sm font-medium">
                      {caseDetail.budget_min && caseDetail.budget_max
                        ? `$${caseDetail.budget_min} - $${caseDetail.budget_max}`
                        : caseDetail.budget_min
                          ? `From $${caseDetail.budget_min}`
                          : `Up to $${caseDetail.budget_max}`}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="text-sm font-medium">{new Date(caseDetail.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Case Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <CaseActivityFeed events={timelineEvents} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Documents ({documents.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => {
                    const uploaderName = doc.uploader
                      ? `${doc.uploader.first_name || ""} ${doc.uploader.last_name || ""}`.trim() || "Unknown"
                      : "Unknown"
                    const uploaderRole = doc.uploader?.user_type === "lawyer" ? "Lawyer" : "Client"
                    const isOwnUpload = doc.uploaded_by === clientId

                    return (
                      <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{doc.file_name}</p>
                            <p className="text-xs text-muted-foreground">
                              Uploaded by {isOwnUpload ? "you" : `${uploaderName} (${uploaderRole})`} • {new Date(doc.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {doc.status}
                          </Badge>
                          {doc.file_url && (
                            <Button variant="ghost" size="sm" asChild>
                              <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                                View
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appointments" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Appointments ({appointments.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {appointments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No appointments scheduled</p>
              ) : (
                <div className="space-y-3">
                  {appointments.map((apt) => {
                    const disp = appointmentDisplayLabel(apt, caseDetail.status)
                    return (
                      <div key={apt.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="text-sm font-medium">
                            {new Date(apt.scheduled_at).toLocaleDateString()} at{" "}
                            {new Date(apt.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Duration: {apt.duration_minutes} minutes •{" "}
                            {disp.hint ? <span title={disp.hint}>Status: {disp.label}</span> : <>Status: {disp.label}</>}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {disp.label}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-4"
                onClick={() => router.push("/client/appointments")}
              >
                <Calendar className="h-4 w-4 mr-2" />
                View All Appointments
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages" className="mt-0">
          <Card className="max-w-lg">
            <CardHeader>
              <CardTitle>Messages</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Open the conversation for this case with your lawyer. Thread context includes this case when you use the link below.
              </p>
              <Button onClick={() => router.push(`/client/messages?case=${caseDetail.id}`)}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Go to messages
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {caseDetail.lawyer && clientId && (
        <ReviewModal
          isOpen={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          caseId={caseDetail.id}
          lawyerId={caseDetail.lawyer.id}
          clientId={clientId}
          onSuccess={() => {
            setHasReviewed(true)
          }}
        />
      )}

      {/* Dispute modal disabled for now
      <DisputeModal
        open={showDisputeModal}
        onOpenChange={setShowDisputeModal}
        caseId={caseId}
        onSuccess={fetchCaseDetail}
      />
      */}
    </main>
  )
}

