"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, AlertCircle, Calendar, Clock, FileText, User, Check, X } from "lucide-react"
import { LawyerDashboardHeader } from "@/components/lawyer/dashboard-header"
import { notifyAppointmentUpdate } from "@/lib/notifications"
import { appointmentStatusLabel, appointmentWorkflowPhase } from "@/lib/appointments-status"
import { appendCaseTimelineEvent, CaseTimelineEventType } from "@/lib/case-timeline"

interface Appointment {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: "pending" | "awaiting_payment" | "scheduled" | "attended" | "completed" | "cancelled" | "rescheduled" | "rejected"
  request_message?: string
  notes?: string
  case: {
    id: string
    title: string
    case_type: string
    description?: string
    hourly_rate?: number | null
  }
  client: {
    id: string
    first_name: string
    last_name: string
    avatar_url: string | null
    email: string
  }
}

export default function LawyerAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [lawyerId, setLawyerId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [rescheduleDraftById, setRescheduleDraftById] = useState<Record<string, string>>({})
  const [rescheduleOpenId, setRescheduleOpenId] = useState<string | null>(null)
  const { toast } = useToast()

  const toDatetimeLocalValue = (iso: string) => {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const hasLawyerSlotConflict = async (
    supabase: ReturnType<typeof createClient>,
    args: { lawyerId: string; appointmentId: string; scheduledAtIso: string; durationMinutes: number },
  ) => {
    const { data: blockedAppointments, error } = await supabase
      .from("appointments")
      .select("id, scheduled_at, duration_minutes")
      .eq("lawyer_id", args.lawyerId)
      .in("status", ["scheduled", "rescheduled", "awaiting_payment"])
      .neq("id", args.appointmentId)

    if (error) throw error

    const slotStart = new Date(args.scheduledAtIso)
    const slotEnd = new Date(slotStart.getTime() + args.durationMinutes * 60000)
    return (blockedAppointments || []).some((apt) => {
      const aptStart = new Date(apt.scheduled_at)
      const aptEnd = new Date(aptStart.getTime() + apt.duration_minutes * 60000)
      return !(slotEnd <= aptStart || slotStart >= aptEnd)
    })
  }

  const loadAppointments = useCallback(async () => {
    try {
      setIsLoading(true)
      const supabase = createClient()

      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session?.user?.id) {
        setError("Not authenticated")
        return
      }

      setLawyerId(sessionData.session.user.id)

      const { data, error: fetchError } = await supabase
        .from("appointments")
        .select(
          `
            id,
            scheduled_at,
            duration_minutes,
            status,
            request_message,
            notes,
            cases (
              id,
              title,
              case_type,
              description
            ),
            profiles!appointments_client_id_fkey (
              id,
              first_name,
              last_name,
              avatar_url,
              email
            )
          `,
        )
        .eq("lawyer_id", sessionData.session.user.id)
        .order("created_at", { ascending: false })

      if (fetchError) throw fetchError

      setAppointments(
        (data || []).map((apt: any) => ({
          id: apt.id,
          scheduled_at: apt.scheduled_at,
          duration_minutes: apt.duration_minutes,
          status: apt.status || "pending",
          request_message: apt.request_message,
          notes: apt.notes,
          case: apt.cases || {},
          client: apt.profiles || {},
        })),
      )
      setError(null)
    } catch (error) {
      console.error("[v0] Fetch error:", error)
      setError("Failed to load appointments")
      toast({
        title: "Error",
        description: "Failed to load your appointments.",
        variant: "destructive",
        duration: 10_000,
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void loadAppointments()
  }, [loadAppointments])

  // Set up real-time subscription for appointment updates
  useEffect(() => {
    if (!lawyerId) {
      console.log("[Appointments] No lawyerId, skipping realtime subscription")
      return
    }

    console.log(`[Appointments] Setting up realtime subscription for lawyer ${lawyerId}`)
    const supabase = createClient()
    const channel = supabase
      .channel(`appointments-lawyer-${lawyerId}-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "appointments",
          filter: `lawyer_id=eq.${lawyerId}`,
        },
        () => {
          void loadAppointments()
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "appointments",
          filter: `lawyer_id=eq.${lawyerId}`,
        },
        (payload) => {
          console.log("[Appointments] 🔔 Realtime update received:", payload)
          const updatedAppointment = payload.new as any
          console.log("[Appointments] Updated appointment:", {
            id: updatedAppointment.id,
            status: updatedAppointment.status,
          })
          setAppointments((prev) =>
            prev.map((apt) => {
              if (apt.id === updatedAppointment.id) {
                console.log(`[Appointments] Updating appointment ${apt.id} status: ${apt.status} → ${updatedAppointment.status}`)
                return { ...apt, status: updatedAppointment.status }
              }
              return apt
            }),
          )
        },
      )
      .subscribe((status) => {
        console.log(`[Appointments] Realtime subscription status: ${status} for lawyer ${lawyerId}`)
        if (status === "SUBSCRIBED") {
          console.log(`[Appointments] ✅ Successfully subscribed to appointment updates for lawyer ${lawyerId}`)
        } else if (status === "CHANNEL_ERROR") {
          console.error(`[Appointments] ❌ Channel error for lawyer ${lawyerId}`)
        }
      })

    return () => {
      console.log(`[Appointments] Cleaning up realtime subscription for lawyer ${lawyerId}`)
      supabase.removeChannel(channel)
    }
  }, [lawyerId, loadAppointments])

  const handleAcceptRequest = async (appointmentId: string) => {
    try {
      setProcessingId(appointmentId)
      const supabase = createClient()
      const targetAppointment = appointments.find((apt) => apt.id === appointmentId)

      if (!targetAppointment || !lawyerId) {
        throw new Error("Appointment not found")
      }

      const hasConflict = await hasLawyerSlotConflict(supabase, {
        lawyerId,
        appointmentId,
        scheduledAtIso: targetAppointment.scheduled_at,
        durationMinutes: targetAppointment.duration_minutes,
      })

      if (hasConflict) {
        toast({
          title: "Schedule conflict",
          description: "You already have a confirmed appointment in this slot. Please coordinate a new time.",
          variant: "destructive",
        })
        return
      }

      console.log(`[Appointments] Updating appointment ${appointmentId} to awaiting_payment`)
      const { error, data: updatedData } = await supabase
        .from("appointments")
        .update({
          status: "awaiting_payment",
          responded_at: new Date().toISOString(),
        })
        .eq("id", appointmentId)
        .select()
        .single()

      if (error) {
        console.error("[Appointments] Update error:", error)
        throw error
      }

      console.log("[Appointments] Update successful:", updatedData)

      // Update local state
      setAppointments(
        appointments.map((apt) => {
          if (apt.id === appointmentId) {
            console.log(`[Appointments] Updating local state for appointment ${appointmentId}: pending → awaiting_payment`)
            return { ...apt, status: "awaiting_payment" as const }
          }
          return apt
        }),
      )

      await notifyAppointmentUpdate(
        supabase,
        "lawyer_accept",
        {
          recipientId: targetAppointment.client.id,
          actorId: lawyerId,
          caseTitle: targetAppointment.case.title,
          scheduledAt: targetAppointment.scheduled_at,
          appointmentId,
          caseId: targetAppointment.case.id,
        }
      )

      await appendCaseTimelineEvent(supabase, {
        caseId: targetAppointment.case.id,
        actorId: lawyerId,
        eventType: CaseTimelineEventType.CONSULTATION_ACCEPTED,
        metadata: {
          appointment_id: appointmentId,
          previous_status: targetAppointment.status,
          status_after: "awaiting_payment",
          action: "lawyer_accepted",
        },
      })

      toast({
        title: "Success",
        description: "Appointment request accepted. The client has been notified.",
      })
    } catch (error) {
      console.error("[v0] Accept error:", error)
      toast({
        title: "Error",
        description: "Failed to accept appointment request.",
        variant: "destructive",
      })
    } finally {
      setProcessingId(null)
    }
  }

  const handleRejectRequest = async (appointmentId: string) => {
    try {
      setProcessingId(appointmentId)
      const supabase = createClient()
      const targetAppointment = appointments.find((apt) => apt.id === appointmentId)

      if (!targetAppointment || !lawyerId) {
        throw new Error("Appointment not found")
      }

      const { error } = await supabase
        .from("appointments")
        .update({
          status: "rejected",
          responded_at: new Date().toISOString(),
        })
        .eq("id", appointmentId)

      if (error) throw error

      // Free the client to book another lawyer after a declined request
      await supabase
        .from("cases")
        .update({
          lawyer_id: null,
          status: "open",
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetAppointment.case.id)

      // Update local state
      setAppointments(
        appointments.map((apt) => (apt.id === appointmentId ? { ...apt, status: "rejected" } : apt)),
      )

      await notifyAppointmentUpdate(
        supabase,
        "lawyer_reject",
        {
          recipientId: targetAppointment.client.id,
          actorId: lawyerId,
          caseTitle: targetAppointment.case.title,
          appointmentId,
          caseId: targetAppointment.case.id,
        }
      )

      await appendCaseTimelineEvent(supabase, {
        caseId: targetAppointment.case.id,
        actorId: lawyerId,
        eventType: CaseTimelineEventType.LAWYER_REJECTED_CONSULTATION,
        metadata: {
          appointment_id: appointmentId,
          previous_status: targetAppointment.status,
          status_after: "rejected",
          action: "lawyer_rejected",
        },
      })

      toast({
        title: "Request Rejected",
        description: "The appointment request has been rejected.",
      })
    } catch (error) {
      console.error("[v0] Reject error:", error)
      toast({
        title: "Error",
        description: "Failed to reject appointment request.",
        variant: "destructive",
      })
    } finally {
      setProcessingId(null)
    }
  }

  const handleMarkAttended = async (appointmentId: string) => {
    try {
      setProcessingId(appointmentId)
      const res = await fetch("/api/appointments/mark-attended", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointment_id: appointmentId }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(json.error || "Failed to update appointment")
      setAppointments((prev) =>
        prev.map((apt) => (apt.id === appointmentId ? { ...apt, status: "attended" as const } : apt)),
      )
      toast({
        title: "Consultation marked as held",
        description: "Next step: go to the Case Detail page and click 'Request Case Completion' when case work is done.",
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not mark consultation as held"
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      })
    } finally {
      setProcessingId(null)
    }
  }

  const handleLawyerCancel = async (appointmentId: string) => {
    try {
      setProcessingId(appointmentId)
      const supabase = createClient()
      const targetAppointment = appointments.find((apt) => apt.id === appointmentId)

      if (!targetAppointment || !lawyerId) throw new Error("Appointment not found")
      if (!["scheduled", "rescheduled", "awaiting_payment"].includes(targetAppointment.status)) {
        throw new Error(`Cannot cancel appointment from status: ${targetAppointment.status}`)
      }

      const { error: updateError } = await supabase
        .from("appointments")
        .update({ status: "cancelled", responded_at: new Date().toISOString() })
        .eq("id", appointmentId)
        .in("status", ["scheduled", "rescheduled", "awaiting_payment"])

      if (updateError) throw updateError

      setAppointments((prev) => prev.map((apt) => (apt.id === appointmentId ? { ...apt, status: "cancelled" } : apt)))

      await notifyAppointmentUpdate(supabase, "lawyer_cancel", {
        recipientId: targetAppointment.client.id,
        actorId: lawyerId,
        caseTitle: targetAppointment.case.title,
        scheduledAt: targetAppointment.scheduled_at,
        appointmentId,
        caseId: targetAppointment.case.id,
      })

      await appendCaseTimelineEvent(supabase, {
        caseId: targetAppointment.case.id,
        actorId: lawyerId,
        eventType: CaseTimelineEventType.LAWYER_CANCELLED_CONSULTATION,
        metadata: {
          appointment_id: appointmentId,
          previous_status: targetAppointment.status,
          status_after: "cancelled",
          action: "lawyer_cancelled",
        },
      })

      toast({
        title: "Appointment cancelled",
        description: "The client has been notified and timeline updated.",
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to cancel appointment"
      toast({ title: "Error", description: message, variant: "destructive" })
    } finally {
      setProcessingId(null)
    }
  }

  const openRescheduleFor = (appointment: Appointment) => {
    setRescheduleDraftById((prev) => ({
      ...prev,
      [appointment.id]: prev[appointment.id] || toDatetimeLocalValue(appointment.scheduled_at),
    }))
    setRescheduleOpenId(appointment.id)
  }

  const handleConfirmReschedule = async (appointmentId: string) => {
    try {
      setProcessingId(appointmentId)
      const supabase = createClient()
      const targetAppointment = appointments.find((apt) => apt.id === appointmentId)
      const draftValue = rescheduleDraftById[appointmentId]
      if (!targetAppointment || !lawyerId) throw new Error("Appointment not found")
      if (!draftValue) throw new Error("Select a new date and time first")
      if (!["scheduled", "rescheduled"].includes(targetAppointment.status)) {
        throw new Error(`Cannot reschedule appointment from status: ${targetAppointment.status}`)
      }

      const newStart = new Date(draftValue)
      if (Number.isNaN(newStart.getTime())) throw new Error("Invalid date/time")
      if (newStart.getTime() <= Date.now()) throw new Error("New appointment time must be in the future")

      const newScheduledAtIso = newStart.toISOString()
      const hasConflict = await hasLawyerSlotConflict(supabase, {
        lawyerId,
        appointmentId,
        scheduledAtIso: newScheduledAtIso,
        durationMinutes: targetAppointment.duration_minutes,
      })
      if (hasConflict) {
        throw new Error("Schedule conflict: you already have an overlapping booking")
      }

      const { error: updateError } = await supabase
        .from("appointments")
        .update({
          status: "rescheduled",
          scheduled_at: newScheduledAtIso,
          responded_at: new Date().toISOString(),
        })
        .eq("id", appointmentId)
        .in("status", ["scheduled", "rescheduled"])

      if (updateError) throw updateError

      setAppointments((prev) =>
        prev.map((apt) =>
          apt.id === appointmentId ? { ...apt, status: "rescheduled", scheduled_at: newScheduledAtIso } : apt,
        ),
      )
      setRescheduleOpenId(null)

      await notifyAppointmentUpdate(supabase, "lawyer_reschedule", {
        recipientId: targetAppointment.client.id,
        actorId: lawyerId,
        caseTitle: targetAppointment.case.title,
        scheduledAt: newScheduledAtIso,
        appointmentId,
        caseId: targetAppointment.case.id,
      })

      await appendCaseTimelineEvent(supabase, {
        caseId: targetAppointment.case.id,
        actorId: lawyerId,
        eventType: CaseTimelineEventType.CONSULTATION_RESCHEDULED,
        metadata: {
          appointment_id: appointmentId,
          previous_status: targetAppointment.status,
          previous_scheduled_at: targetAppointment.scheduled_at,
          scheduled_at: newScheduledAtIso,
          duration_minutes: targetAppointment.duration_minutes,
          status_after: "rescheduled",
          action: "lawyer_rescheduled",
        },
      })

      toast({
        title: "Appointment rescheduled",
        description: "The client has been notified of the new time.",
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to reschedule appointment"
      toast({ title: "Error", description: message, variant: "destructive" })
    } finally {
      setProcessingId(null)
    }
  }

  const pendingAppointments = appointments.filter((apt) => apt.status === "pending")
  const awaitingPaymentAppointments = appointments.filter((apt) => apt.status === "awaiting_payment")
  const otherAppointments = appointments.filter(
    (apt) => apt.status !== "pending" && apt.status !== "awaiting_payment",
  )

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <LawyerDashboardHeader />
        <div className="mx-auto max-w-7xl px-4 py-10">
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <LawyerDashboardHeader />
        <div className="mx-auto max-w-7xl px-4 py-10">
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

      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
        <main className="space-y-6">
            <div className="mb-8">
              <h1 className="text-3xl font-bold">Appointment Requests</h1>
              <p className="mt-2 text-muted-foreground">Review and manage client appointment requests</p>
            </div>

            {/* Pending Requests */}
            {pendingAppointments.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold">Pending Requests</h2>
                  <Badge className="bg-orange-500/20 text-orange-700 dark:text-orange-400">
                    {pendingAppointments.length} New
                  </Badge>
                </div>

                {pendingAppointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="rounded-lg border border-orange-200 bg-orange-50/50 dark:bg-orange-950/20 p-6"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-4 flex-1">
                        <div className="flex items-center gap-3">
                          {appointment.client.avatar_url ? (
                            <img
                              src={appointment.client.avatar_url}
                              alt={`${appointment.client.first_name} ${appointment.client.last_name}`}
                              className="h-12 w-12 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                              <User className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-lg">
                              {appointment.client.first_name} {appointment.client.last_name}
                            </p>
                            <p className="text-sm text-muted-foreground">{appointment.client.email}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-xs text-muted-foreground">Date</p>
                              <p className="text-sm font-medium">
                                {new Date(appointment.scheduled_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-xs text-muted-foreground">Time</p>
                              <p className="text-sm font-medium">
                                {new Date(appointment.scheduled_at).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}{" "}
                                ({appointment.duration_minutes}m)
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-xs text-muted-foreground">Case Type</p>
                              <p className="text-sm font-medium">{appointment.case.case_type || "Consultation"}</p>
                            </div>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Case Title</p>
                          <p className="text-sm font-medium">{appointment.case.title || "N/A"}</p>
                        </div>

                        {appointment.request_message && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Client Message</p>
                            <p className="text-sm bg-background rounded p-3 border border-border">
                              {appointment.request_message}
                            </p>
                          </div>
                        )}

                        {appointment.case.description && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Case Description</p>
                            <p className="text-sm text-muted-foreground line-clamp-2">{appointment.case.description}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-transparent text-destructive border-destructive hover:bg-destructive hover:text-white"
                            onClick={() => handleRejectRequest(appointment.id)}
                            disabled={processingId === appointment.id}
                          >
                            {processingId === appointment.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <X className="h-4 w-4 mr-1" />
                                Reject
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleAcceptRequest(appointment.id)}
                            disabled={processingId === appointment.id}
                          >
                            {processingId === appointment.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Check className="h-4 w-4 mr-1" />
                                Accept
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Awaiting Payment */}
            {awaitingPaymentAppointments.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold">Awaiting Payment</h2>
                  <Badge className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400">
                    {awaitingPaymentAppointments.length} Pending
                  </Badge>
                </div>

                {awaitingPaymentAppointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="rounded-lg border border-yellow-200 bg-yellow-50/30 dark:bg-yellow-950/20 dark:border-yellow-800/50 shadow-sm p-6"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-4 flex-1">
                        <div className="flex items-center gap-3">
                          {appointment.client.avatar_url ? (
                            <img
                              src={appointment.client.avatar_url}
                              alt={`${appointment.client.first_name} ${appointment.client.last_name}`}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                              <User className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <p className="font-semibold">
                              {appointment.client.first_name} {appointment.client.last_name}
                            </p>
                            <p className="text-sm text-muted-foreground">{appointment.case.case_type || "Consultation"}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-xs text-muted-foreground">Date</p>
                              <p className="text-sm font-medium">
                                {new Date(appointment.scheduled_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-xs text-muted-foreground">Time</p>
                              <p className="text-sm font-medium">
                                {new Date(appointment.scheduled_at).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}{" "}
                                ({appointment.duration_minutes}m)
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-xs text-muted-foreground">Case</p>
                              <p className="text-sm font-medium">{appointment.case.title || "N/A"}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 items-end">
                        <span className="inline-flex rounded-full px-3 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800">
                          Awaiting Payment
                        </span>
                        <p className="text-xs text-muted-foreground text-right">Waiting for client payment</p>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={processingId === appointment.id}
                          onClick={() => void handleLawyerCancel(appointment.id)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Other Appointments */}
            {otherAppointments.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold">All Appointments</h2>

                {otherAppointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className={`rounded-lg border ${
                      appointment.status === "rejected"
                        ? "border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900/50"
                        : appointment.status === "awaiting_payment"
                          ? "border-yellow-200 bg-yellow-50/30 dark:bg-yellow-950/20 dark:border-yellow-800/50 shadow-sm"
                          : appointment.status === "scheduled"
                            ? "border-blue-200 bg-blue-50/30 dark:bg-blue-950/20 dark:border-blue-800/50 shadow-sm"
                            : appointment.status === "attended" || appointment.status === "completed"
                              ? "border-green-200 bg-green-50/30 dark:bg-green-950/20 dark:border-green-800/50"
                              : appointment.status === "cancelled"
                                ? "border-gray-200 bg-gray-50/30 dark:bg-gray-900/20 dark:border-gray-800/50 opacity-75"
                                : "border-border bg-card"
                    } p-6 transition-all hover:shadow-md`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-4 flex-1">
                        <div className="flex items-center gap-3">
                          {appointment.client.avatar_url ? (
                            <img
                              src={appointment.client.avatar_url}
                              alt={`${appointment.client.first_name} ${appointment.client.last_name}`}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                              <User className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium">
                              {appointment.client.first_name} {appointment.client.last_name}
                            </p>
                            <p className="text-sm text-muted-foreground">{appointment.case.case_type || "Consultation"}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-xs text-muted-foreground">Date</p>
                              <p className="text-sm font-medium">
                                {new Date(appointment.scheduled_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-xs text-muted-foreground">Time</p>
                              <p className="text-sm font-medium">
                                {new Date(appointment.scheduled_at).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}{" "}
                                ({appointment.duration_minutes}m)
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-xs text-muted-foreground">Case</p>
                              <p className="text-sm font-medium">{appointment.case.title || "N/A"}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 items-end">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                            appointment.status === "awaiting_payment"
                              ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800"
                              : appointment.status === "scheduled"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                                : appointment.status === "attended" || appointment.status === "completed"
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-800"
                                : appointment.status === "rejected"
                                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800"
                                  : appointment.status === "cancelled"
                                    ? "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
                                    : "bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-300"
                          }`}
                        >
                          {appointment.status === "awaiting_payment"
                            ? "Awaiting Payment"
                            : appointmentStatusLabel(appointment.status)}
                        </span>
                        <p className="text-[11px] text-muted-foreground">Workflow: {appointmentWorkflowPhase(appointment.status)}</p>
                        {appointment.status === "attended" && (
                          <div className="mt-1 text-right">
                            <p className="text-xs text-green-700 dark:text-green-400 font-medium">Consultation held</p>
                            <a
                              href={`/lawyer/cases/${appointment.case.id}`}
                              className="text-xs text-primary hover:underline"
                            >
                              Go to Case → Request Case Completion
                            </a>
                          </div>
                        )}
                        {(appointment.status === "scheduled" || appointment.status === "rescheduled") && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-2"
                              disabled={processingId === appointment.id}
                              onClick={() => void handleMarkAttended(appointment.id)}
                            >
                              {processingId === appointment.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Mark Consultation Held"
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-2"
                              disabled={processingId === appointment.id}
                              onClick={() => openRescheduleFor(appointment)}
                            >
                              Reschedule
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="mt-2"
                              disabled={processingId === appointment.id}
                              onClick={() => void handleLawyerCancel(appointment.id)}
                            >
                              Cancel
                            </Button>
                            {rescheduleOpenId === appointment.id && (
                              <div className="mt-2 w-full rounded-md border p-2">
                                <label className="mb-1 block text-[11px] text-muted-foreground">New date & time</label>
                                <input
                                  type="datetime-local"
                                  className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                                  value={rescheduleDraftById[appointment.id] || ""}
                                  min={toDatetimeLocalValue(new Date().toISOString())}
                                  onChange={(e) =>
                                    setRescheduleDraftById((prev) => ({ ...prev, [appointment.id]: e.target.value }))
                                  }
                                />
                                <div className="mt-2 flex gap-2">
                                  <Button
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    disabled={processingId === appointment.id}
                                    onClick={() => void handleConfirmReschedule(appointment.id)}
                                  >
                                    Confirm
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-xs"
                                    disabled={processingId === appointment.id}
                                    onClick={() => setRescheduleOpenId(null)}
                                  >
                                    Close
                                  </Button>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {appointments.length === 0 && (
              <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
                <Calendar className="mx-auto h-12 w-12 text-muted-foreground/40" />
                <h3 className="mt-4 font-semibold">No appointments yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">Appointment requests from clients will appear here</p>
              </div>
            )}
        </main>
      </div>
    </div>
  )
}

