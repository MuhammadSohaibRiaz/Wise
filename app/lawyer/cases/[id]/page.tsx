"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  Save,
  Brain,
  LayoutDashboard,
  History,
} from "lucide-react"
import { LawyerDashboardHeader } from "@/components/lawyer/dashboard-header"
import { createNotification } from "@/lib/notifications"
import { appointmentDisplayLabel } from "@/lib/appointment-display"
import { isAppointmentBillable } from "@/lib/appointments-status"
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
  client: {
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
  document_analysis?: { id: string; analysis_status: string }[] | null
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

export default function LawyerCaseDetailPage() {
  const params = useParams()
  const caseId = params.id as string
  const router = useRouter()
  const { toast } = useToast()

  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<CaseDetail["status"] | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [timelineEvents, setTimelineEvents] = useState<CaseTimelineEventRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lawyerId, setLawyerId] = useState<string | null>(null)
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false)
  const [privateNotes, setPrivateNotes] = useState("")
  const [isSavingNotes, setIsSavingNotes] = useState(false)
  const [selectedAnalysis, setSelectedAnalysis] = useState<Record<string, unknown> | null>(null)
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

      setLawyerId(sessionData.session.user.id)

      const caseSelectWithNotes = `
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
          client_id,
          private_notes,
          client:profiles!cases_client_id_fkey (
            id,
            first_name,
            last_name,
            avatar_url,
            email
          )
        `

      const caseSelectBase = `
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
          client_id,
          client:profiles!cases_client_id_fkey (
            id,
            first_name,
            last_name,
            avatar_url,
            email
          )
        `

      let { data: caseData, error: caseError } = await supabase
        .from("cases")
        .select(caseSelectWithNotes)
        .eq("id", caseId)
        .eq("lawyer_id", sessionData.session.user.id)
        .maybeSingle()

      const errText = `${caseError?.message || ""} ${(caseError as any)?.details || ""}`.toLowerCase()
      if (caseError && errText.includes("private_notes")) {
        const retry = await supabase
          .from("cases")
          .select(caseSelectBase)
          .eq("id", caseId)
          .eq("lawyer_id", sessionData.session.user.id)
          .maybeSingle()
        caseData = retry.data as typeof caseData
        caseError = retry.error
      }

      if (caseError) throw caseError
      if (!caseData) {
        setError("Case not found or you don't have access to this case.")
        return
      }

      const mappedCase: CaseDetail = {
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
        client: caseData.client || null,
      }

      setCaseDetail(mappedCase)
      setSelectedStatus(mappedCase.status)

      // Fetch appointments
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from("appointments")
        .select("id, scheduled_at, duration_minutes, status, notes")
        .eq("case_id", caseId)
        .order("scheduled_at", { ascending: false })

      if (appointmentsError) throw appointmentsError
      setAppointments(appointmentsData || [])

      let documentsPayload: Document[] = []
      const { data: documentsData, error: documentsError } = await supabase
        .from("documents")
        .select(`
          id, 
          file_name, 
          file_url, 
          file_type, 
          document_type, 
          status, 
          created_at, 
          uploaded_by,
          document_analysis (
            id,
            analysis_status
          ),
          uploader:profiles!documents_uploaded_by_fkey (
            first_name, last_name, user_type
          )
        `)
        .eq("case_id", caseId)
        .order("created_at", { ascending: false })

      if (!documentsError && documentsData) {
        documentsPayload = documentsData as Document[]
      } else {
        const { data: docsSimple, error: docsSimpleError } = await supabase
          .from("documents")
          .select(`
            id, file_name, file_url, file_type, document_type, status, created_at, uploaded_by,
            uploader:profiles!documents_uploaded_by_fkey (
              first_name, last_name, user_type
            )
          `)
          .eq("case_id", caseId)
          .order("created_at", { ascending: false })
        if (docsSimpleError) throw docsSimpleError
        documentsPayload = (docsSimple || []).map((d) => ({ ...d, document_analysis: [] as any }))
      }
      setDocuments(documentsPayload)

      const { data: timelineData, error: timelineError } = await supabase
        .from("case_timeline_events")
        .select("id, event_type, metadata, created_at")
        .eq("case_id", caseId)
        .order("created_at", { ascending: true })

      if (timelineError) throw timelineError
      setTimelineEvents((timelineData as CaseTimelineEventRow[]) || [])

      setPrivateNotes((caseData as { private_notes?: string }).private_notes || "")

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
    const topic = `lawyer-case-detail-${caseId}-${Date.now()}`
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

  const fetchAnalysis = async (analysisId: string) => {
    try {
      setIsAnalysisLoading(true)
      const supabase = createClient()
      const { data, error } = await supabase
        .from("document_analysis")
        .select("*")
        .eq("id", analysisId)
        .single()

      if (error) throw error
      setSelectedAnalysis(data)
    } catch (error) {
      console.error("Error fetching analysis:", error)
      toast({
        title: "Error",
        description: "Failed to load analysis results",
        variant: "destructive"
      })
    } finally {
      setIsAnalysisLoading(false)
    }
  }

  const handleStatusUpdate = async (nextStatus?: CaseDetail["status"]) => {
    const statusToApply = nextStatus ?? selectedStatus
    if (!caseDetail || !statusToApply || statusToApply === caseDetail.status || !lawyerId) {
      return
    }

    if (statusToApply === "pending_completion" && !hasAttendedAppointment) {
      toast({
        title: "Consultation required",
        description:
          "At least one consultation must be marked as held before requesting completion.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSaving(true)
      const supabase = createClient()

      const { error: updateError } = await supabase
        .from("cases")
        .update({
          status: statusToApply,
          updated_at: new Date().toISOString(),
        })
        .eq("id", caseId)

      if (updateError) throw updateError

      // Send notification to client
      if (caseDetail.client?.id) {
        await createNotification(
          supabase,
          {
            user_id: caseDetail.client.id,
            created_by: lawyerId,
            type: "case_update",
            title: "Case status updated",
            description: `Your case "${caseDetail.title}" status has been changed to ${(statusConfig as Record<string, { label: string }>)[statusToApply]?.label ?? statusToApply}`,
            data: {
              case_id: caseId,
              status: statusToApply,
              previous_status: caseDetail.status,
            },
          }
        )
      }

      setCaseDetail({ ...caseDetail, status: statusToApply, updated_at: new Date().toISOString() })

      if (statusToApply === "pending_completion") {
        // Email notification sent to client — see /api/notify/email
        fetch("/api/notify/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            template: "case_completion_request",
            data: { client_id: caseDetail.client?.id, lawyer_id: lawyerId, case_title: caseDetail.title, case_id: caseId },
          }),
        }).catch(() => {})

        toast({
          title: "Case completion requested",
          description: "The client has been notified. They will confirm completion and can then leave a review.",
        })
      } else {
        toast({
          title: "Success",
          description: "Case status updated successfully.",
        })
      }
    } catch (error) {
      console.error("[v0] Status update error:", error)
      toast({
        title: "Error",
        description: "Failed to update case status.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const hasAttendedAppointment = appointments.some(
    (a) => a.status === "attended" || a.status === "completed",
  )

  const handleRequestCompletion = async () => {
    if (!caseDetail) return
    if (caseDetail.status !== "in_progress") {
      toast({
        title: "Not available",
        description: "Completion can only be requested when the case is in progress.",
        variant: "destructive",
      })
      return
    }

    if (!hasAttendedAppointment) {
      toast({
        title: "Consultation required",
        description:
          "At least one consultation must be marked as held before you can request case completion.",
        variant: "destructive",
      })
      return
    }

    setSelectedStatus("pending_completion")
    await handleStatusUpdate("pending_completion")
  }

  const handleSaveNotes = async () => {
    try {
      setIsSavingNotes(true)
      const supabase = createClient()
      const { error } = await supabase
        .from("cases")
        .update({ private_notes: privateNotes })
        .eq("id", caseId)

      if (error) throw error

      toast({
        title: "Notes Saved",
        description: "Your private notes have been updated."
      })
    } catch (error) {
      console.error("Error saving notes:", error)
      toast({
        title: "Error",
        description: "Failed to save notes. The table might need a schema update.",
        variant: "destructive"
      })
    } finally {
      setIsSavingNotes(false)
    }
  }

  const calculateTotalBilled = () => {
    const completedAppointments = appointments.filter((a) => isAppointmentBillable(a.status))
    const totalMinutes = completedAppointments.reduce((acc, apt) => acc + (apt.duration_minutes || 0), 0)
    const rate = caseDetail?.hourly_rate || 0
    return (totalMinutes / 60) * rate
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

  if (error || !caseDetail) {
    return (
      <div className="min-h-screen bg-background">
        <LawyerDashboardHeader />
        <div className="px-4 py-4 md:px-6 md:py-6 lg:px-8 max-w-7xl mx-auto">
          <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
            <div>
              <h2 className="font-semibold text-red-900">Error</h2>
              <p className="text-sm text-red-700">{error || "Case not found"}</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => router.push("/lawyer/cases")} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Cases
          </Button>
        </div>
      </div>
    )
  }

  const statusInfo = statusConfig[caseDetail.status] ?? statusConfig.in_progress
  const clientName = caseDetail.client
    ? `${caseDetail.client.first_name || ""} ${caseDetail.client.last_name || ""}`.trim() || "Unknown Client"
    : "No client assigned"

  return (
    <div className="min-h-screen bg-background">
      <LawyerDashboardHeader />

      <div className="px-4 py-4 md:px-6 md:py-6 lg:px-8 max-w-7xl mx-auto">
          <main className="space-y-6">
        {caseDetail.status === "in_progress" && (
          <Card className={`border-2 ${hasAttendedAppointment ? "border-purple-200 bg-purple-50 dark:bg-purple-950/20" : "border-amber-200 bg-amber-50 dark:bg-amber-950/20"}`}>
            <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                {hasAttendedAppointment ? (
                  <>
                    <p className="font-bold text-purple-900 dark:text-purple-300">Ready to close this case?</p>
                    <p className="text-sm text-purple-700 dark:text-purple-400">
                      Request case completion so the client can confirm and leave a review.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-bold text-amber-900 dark:text-amber-300">Consultation required first</p>
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      At least one consultation must be marked as &ldquo;held&rdquo; before you can request case completion.
                      The client or you can mark it from the Appointments page.
                    </p>
                  </>
                )}
              </div>
              <Button
                className={hasAttendedAppointment ? "bg-purple-700 hover:bg-purple-800 text-white" : ""}
                variant={hasAttendedAppointment ? "default" : "outline"}
                onClick={handleRequestCompletion}
                disabled={isSaving || !hasAttendedAppointment}
              >
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Request Case Completion
              </Button>
            </CardContent>
          </Card>
        )}
            <div className="flex items-center justify-between">
              <div>
                <Button variant="ghost" onClick={() => router.push("/lawyer/cases")} className="mb-4">
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
                <Button variant="outline" onClick={() => router.push(`/lawyer/messages?case=${caseDetail.id}`)}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Message
                </Button>
              </div>
            </div>

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
                <div className="grid gap-6 md:grid-cols-2">
                  <Card>
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
                          <p className="text-xs text-muted-foreground">Client</p>
                          <p className="text-sm font-medium">{clientName}</p>
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

                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Status Management</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <p className="text-sm font-medium mb-2">Current Status</p>
                          <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
                        </div>

                        {caseDetail.status === "closed" ? (
                          <p className="text-sm text-muted-foreground">This case has been archived and cannot be reopened.</p>
                        ) : caseDetail.status === "completed" ? (
                          <div className="space-y-3">
                            <p className="text-sm text-muted-foreground">
                              Case completed. You can archive it to move it out of your active view.
                            </p>
                            <Button
                              variant="outline"
                              onClick={() => { setSelectedStatus("closed"); handleStatusUpdate("closed"); }}
                              disabled={isSaving}
                              className="w-full"
                            >
                              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                              Archive Case
                            </Button>
                          </div>
                        ) : caseDetail.status === "pending_completion" ? (
                          <p className="text-sm text-muted-foreground">
                            Waiting for the client to confirm completion. Status changes are locked until the client responds.
                          </p>
                        ) : (
                          <>
                            <div>
                              <p className="text-sm font-medium mb-2">Update Status</p>
                              <Select value={selectedStatus || ""} onValueChange={(value) => setSelectedStatus(value as CaseDetail["status"])}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="open">Open</SelectItem>
                                  <SelectItem value="in_progress">In Progress</SelectItem>
                                  <SelectItem value="pending_completion" disabled={!hasAttendedAppointment}>
                                    Request Case Completion {!hasAttendedAppointment ? "(needs attended consult)" : ""}
                                  </SelectItem>
                                  <SelectItem value="completed" disabled>Completed (Client confirms)</SelectItem>
                                  <SelectItem value="closed" disabled>Closed (after completion)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {selectedStatus !== caseDetail.status && (
                              <Button
                                onClick={() => handleStatusUpdate()}
                                disabled={isSaving}
                                className="w-full"
                              >
                                {isSaving ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Saving...
                                  </>
                                ) : (
                                  <>
                                    <Save className="h-4 w-4 mr-2" />
                                    Update Status
                                  </>
                                )}
                              </Button>
                            )}
                          </>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-green-600" />
                          Billing & Settlement
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 border-b pb-4">
                          <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase">Rate</p>
                            <p className="text-sm font-medium">${caseDetail.hourly_rate || 0}/hr</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase">Total Billed</p>
                            <p className="text-sm font-bold text-green-600">${calculateTotalBilled().toFixed(2)}</p>
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground">Confirmed Hours:</span>
                          <span className="font-medium">
                            {(appointments.filter((a) => isAppointmentBillable(a.status)).reduce((acc, a) => acc + a.duration_minutes, 0) / 60).toFixed(1)} hrs
                          </span>
                        </div>
                        <Button variant="outline" size="sm" className="w-full text-xs" disabled>
                          Generate Invoice (Coming Soon)
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-lg">Private Lawyer Notes</CardTitle>
                    <Button 
                      size="sm" 
                      onClick={handleSaveNotes} 
                      disabled={isSavingNotes}
                      className="h-8"
                    >
                      {isSavingNotes ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Save className="h-3 w-3 mr-2" />}
                      Save Notes
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <textarea
                      value={privateNotes}
                      onChange={(e) => setPrivateNotes(e.target.value)}
                      placeholder="Keep track of case details, evidence, and internal strategy here. Only you can see these notes."
                      className="min-h-[150px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                    <p className="mt-2 text-[10px] text-muted-foreground italic">
                      * Private notes are encrypted and never shared with the client.
                    </p>
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
                          const isOwnUpload = doc.uploaded_by === lawyerId

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
                                {(doc as { document_analysis?: { id: string }[] }).document_analysis?.[0]?.id && (
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() =>
                                      fetchAnalysis(
                                        (doc as { document_analysis: { id: string }[] }).document_analysis[0].id,
                                      )
                                    }
                                    disabled={isAnalysisLoading}
                                  >
                                    {isAnalysisLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "AI Analysis"}
                                  </Button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    
                    {selectedAnalysis && (
                      <div className="mt-6 pt-6 border-t animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-semibold text-lg flex items-center gap-2">
                            <Brain className="h-5 w-5 text-primary" />
                            AI Analysis Results
                          </h3>
                          <Button variant="ghost" size="sm" onClick={() => setSelectedAnalysis(null)}>
                            Close Analysis
                          </Button>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-4 space-y-4">
                          <div>
                            <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Summary</p>
                            <p className="text-sm leading-relaxed">{String(selectedAnalysis.summary ?? "")}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Risk Level</p>
                              <Badge variant={selectedAnalysis.risk_level === "High" ? "destructive" : "secondary"}>
                                {String(selectedAnalysis.risk_level ?? "")}
                              </Badge>
                            </div>
                            <div>
                              <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Urgency</p>
                              <Badge variant="outline">{String(selectedAnalysis.urgency ?? "")}</Badge>
                            </div>
                          </div>
                          {(() => {
                            const raw = selectedAnalysis.recommendations as unknown
                            const list: string[] = Array.isArray(raw)
                              ? (raw as string[])
                              : typeof raw === "string"
                                ? (() => {
                                    try {
                                      const p = JSON.parse(raw)
                                      return Array.isArray(p) ? p.map(String) : []
                                    } catch {
                                      return []
                                    }
                                  })()
                                : []
                            return list.length > 0 ? (
                            <div>
                              <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Recommendations</p>
                              <ul className="list-disc ml-4 text-sm space-y-1">
                                {list.map((rec: string, i: number) => (
                                  <li key={i}>{rec}</li>
                                ))}
                              </ul>
                            </div>
                            ) : null
                          })()}
                        </div>
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
                    <Button variant="outline" size="sm" className="w-full mt-4" onClick={() => router.push("/lawyer/appointments")}>
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
                      Open the conversation for this case with your client.
                    </p>
                    <Button onClick={() => router.push(`/lawyer/messages?case=${caseDetail.id}`)}>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Go to messages
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </main>
      </div>
    </div>
  )
}

