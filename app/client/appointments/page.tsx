"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Loader2, AlertCircle, Calendar, Clock, FileText, CreditCard, CheckCircle2 } from "lucide-react"
import { notifyAppointmentUpdate } from "@/lib/notifications"
import { appointmentStatusLabel, appointmentWorkflowPhase } from "@/lib/appointments-status"
import { appendCaseTimelineEvent, CaseTimelineEventType } from "@/lib/case-timeline"
import { PaymentButton } from "@/components/payments/payment-button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface Appointment {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: "pending" | "awaiting_payment" | "scheduled" | "attended" | "completed" | "cancelled" | "rescheduled" | "rejected"
  payment_status?: "pending" | "completed" | "failed" | null
  case: {
    id: string
    title: string
    case_type: string
    hourly_rate: number | null
  }
  lawyer: {
    id: string
    first_name: string
    last_name: string
    avatar_url: string | null
  }
}

export default function ClientAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clientId, setClientId] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const { toast } = useToast()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Check for payment success/failure in URL params
    const paymentStatus = searchParams.get("payment")
    const sessionId = searchParams.get("session_id")

    if (paymentStatus === "success" && sessionId) {
      console.log("[Client Appointments] Payment success detected, session_id:", sessionId)

      // Verify payment status with Stripe (fallback for when webhook doesn't fire)
      const verifyPayment = async () => {
        try {
          const response = await fetch("/api/stripe/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }),
          })

          if (response.ok) {
            const data = await response.json()
            console.log("[Client Appointments] Payment verification result:", data)

            toast({
              title: "Payment Successful",
              description: "Your appointment has been confirmed. Refreshing...",
            })

            // Refresh after a short delay
            setTimeout(() => {
              window.location.href = "/client/appointments"
            }, 2000)
          } else {
            console.error("[Client Appointments] Payment verification failed")
            // Still redirect but show message
            toast({
              title: "Payment Processing",
              description: "Your payment is being processed. The page will refresh shortly.",
            })
            setTimeout(() => {
              window.location.href = "/client/appointments"
            }, 3000)
          }
        } catch (error) {
          console.error("[Client Appointments] Error verifying payment:", error)
          // Fallback: just refresh
          setTimeout(() => {
            window.location.href = "/client/appointments"
          }, 2000)
        }
      }

      verifyPayment()
      return
    } else if (paymentStatus === "cancelled") {
      toast({
        title: "Payment Cancelled",
        description: "Your appointment is still awaiting payment.",
        variant: "default",
      })
      // Clean URL
      window.history.replaceState({}, "", "/client/appointments")
    }

    const fetchAppointments = async (retryCount = 0) => {
      try {
        setIsLoading(true)
        const supabase = createClient()

        const { data: sessionData } = await supabase.auth.getSession()
        if (!sessionData.session?.user?.id) {
          setError("Not authenticated")
          return
        }
        setClientId(sessionData.session.user.id)

        const { data, error: fetchError } = await supabase
          .from("appointments")
          .select(
            `
            id,
            scheduled_at,
            duration_minutes,
            status,
            created_at,
            case_id,
            cases (
              id,
              title,
              case_type,
              hourly_rate
            ),
            profiles!appointments_lawyer_id_fkey (
              id,
              first_name,
              last_name,
              avatar_url
            )
          `,
          )
          .eq("client_id", sessionData.session.user.id)
          .order("created_at", { ascending: false })

        if (fetchError) {
          if (retryCount < 2) {
            await new Promise((r) => setTimeout(r, 1500))
            return fetchAppointments(retryCount + 1)
          }
          throw fetchError
        }

        // Fetch payment status for each appointment
        const appointmentIds = (data || []).map((apt: any) => apt.id)
        let paymentStatuses: Record<string, string> = {}

        if (appointmentIds.length > 0) {
          const { data: paymentsData } = await supabase
            .from("payments")
            .select("case_id, status")
            .in("case_id", (data || []).map((apt: any) => apt.case_id))

          if (paymentsData) {
            paymentsData.forEach((payment) => {
              paymentStatuses[payment.case_id] = payment.status
            })
          }
        }

        const mappedAppointments = (data || []).map((apt: any) => ({
          id: apt.id,
          scheduled_at: apt.scheduled_at,
          duration_minutes: apt.duration_minutes,
          status: apt.status || "pending",
          // Get payment status from payments table
          payment_status: paymentStatuses[apt.case_id] || null,
          case: apt.cases || { id: "", title: "", case_type: "", hourly_rate: null },
          lawyer: apt.profiles || {},
        }))

        console.log("[Client Appointments] Loaded appointments:", mappedAppointments.map(apt => ({
          id: apt.id,
          status: apt.status,
          case: apt.case.title
        })))

        setAppointments(mappedAppointments)
      } catch (error) {
        console.error("[v0] Fetch error:", error)
        setError("Failed to load appointments")
        toast({
          title: "Error",
          description: "Failed to load your appointments.",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchAppointments()
  }, [toast, searchParams])

  // Set up real-time subscription for appointment updates
  useEffect(() => {
    if (!clientId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`appointments-client-${clientId}-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "appointments",
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          const updatedAppointment = payload.new as any
          setAppointments((prev) =>
            prev.map((apt) => (apt.id === updatedAppointment.id ? { ...apt, status: updatedAppointment.status } : apt)),
          )
          if (updatedAppointment.status === "awaiting_payment") {
            toast({
              title: "Payment Required",
              description: "Your appointment has been approved. Please complete payment to confirm your booking.",
            })
          } else if (updatedAppointment.status === "scheduled") {
            toast({
              title: "Appointment Confirmed",
              description: "Your payment was successful and your appointment is now confirmed.",
            })
          }
        },
      )
      .subscribe((status) => {
        console.log(`[Client Appointments] Realtime subscription status: ${status} for client ${clientId}`)
        if (status === "SUBSCRIBED") {
          console.log(`[Client Appointments] ✅ Successfully subscribed to appointment updates for client ${clientId}`)
        } else if (status === "CHANNEL_ERROR") {
          console.error(`[Client Appointments] ❌ Channel error for client ${clientId}`)
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [clientId, toast])

  const handleCancelAppointment = async (appointmentId: string) => {
    try {
      const supabase = createClient()
      const targetAppointment = appointments.find((apt) => apt.id === appointmentId)

      const { error } = await supabase.from("appointments").update({ status: "cancelled" }).eq("id", appointmentId)

      if (error) throw error

      setAppointments(appointments.map((apt) => (apt.id === appointmentId ? { ...apt, status: "cancelled" } : apt)))

      if (clientId && targetAppointment?.case?.id) {
        await appendCaseTimelineEvent(supabase, {
          caseId: targetAppointment.case.id,
          actorId: clientId,
          eventType: CaseTimelineEventType.APPOINTMENT_CANCELLED,
          metadata: { appointment_id: appointmentId },
        })
      }

      if (clientId && targetAppointment?.lawyer?.id) {
        await notifyAppointmentUpdate(
          supabase,
          "client_cancel",
          {
            recipientId: targetAppointment.lawyer.id,
            actorId: clientId,
            caseTitle: targetAppointment.case.title,
            scheduledAt: targetAppointment.scheduled_at,
            appointmentId,
            caseId: targetAppointment.case.id,
          },
        )
      }

      toast({
        title: "Appointment Cancelled",
        description: "Your appointment has been cancelled successfully.",
      })
    } catch (error) {
      console.error("[v0] Cancel error:", error)
      toast({
        title: "Error",
        description: "Failed to cancel appointment.",
        variant: "destructive",
      })
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
        description: "The lawyer can now request case completion when the case work is done. You'll confirm it from the Case page.",
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not mark consultation as held"
      toast({ title: "Error", description: message, variant: "destructive" })
    } finally {
      setProcessingId(null)
    }
  }

  if (isLoading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
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
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Your Appointments</h1>
        <p className="mt-2 text-muted-foreground">Manage your upcoming consultations and scheduled meetings</p>
      </div>

      {appointments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <Calendar className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <h3 className="mt-4 font-semibold">No appointments yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">Browse lawyers and book your first consultation</p>
          <a href="/match" className="mt-4 inline-block">
            <Button>Find a Lawyer</Button>
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {appointments.map((appointment) => (
            <div
              key={appointment.id}
              className={`rounded-lg border ${appointment.status === "cancelled"
                ? "border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900/50 opacity-75"
                : appointment.status === "pending"
                  ? "border-orange-200 bg-orange-50/30 dark:bg-orange-950/20 dark:border-orange-800/50"
                  : appointment.status === "awaiting_payment"
                    ? "border-yellow-200 bg-yellow-50/30 dark:bg-yellow-950/20 dark:border-yellow-800/50 shadow-sm"
                    : appointment.status === "scheduled"
                      ? "border-blue-200 bg-blue-50/30 dark:bg-blue-950/20 dark:border-blue-800/50 shadow-sm"
                      : appointment.status === "attended" || appointment.status === "completed"
                        ? "border-green-200 bg-green-50/30 dark:bg-green-950/20 dark:border-green-800/50"
                        : appointment.status === "rejected"
                          ? "border-red-200 bg-red-50/30 dark:bg-red-950/20 dark:border-red-800/50"
                          : "border-border bg-card"
                } p-6 transition-all hover:shadow-md`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-4 flex-1">
                  <div className="flex items-center gap-3">
                    {appointment.lawyer.avatar_url ? (
                      <img
                        src={appointment.lawyer.avatar_url || "/placeholder.svg"}
                        alt={`${appointment.lawyer.first_name} ${appointment.lawyer.last_name}`}
                        className={`h-10 w-10 rounded-full object-cover ${appointment.status === "cancelled" ? "opacity-50 grayscale" : ""
                          }`}
                      />
                    ) : (
                      <div
                        className={`h-10 w-10 rounded-full bg-muted flex items-center justify-center ${appointment.status === "cancelled" ? "opacity-50" : ""
                          }`}
                      >
                        <span className="text-sm font-medium text-muted-foreground">
                          {appointment.lawyer.first_name?.charAt(0)}
                          {appointment.lawyer.last_name?.charAt(0)}
                        </span>
                      </div>
                    )}
                    <div>
                      <p
                        className={`font-medium ${appointment.status === "cancelled" ? "text-muted-foreground line-through" : ""
                          }`}
                      >
                        {appointment.lawyer.first_name} {appointment.lawyer.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground">{appointment.case.case_type || "Consultation"}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Date</p>
                        <p className="text-sm font-medium">{new Date(appointment.scheduled_at).toLocaleDateString()}</p>
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
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${appointment.status === "pending"
                      ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border border-orange-200 dark:border-orange-800"
                      : appointment.status === "awaiting_payment"
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
                    {appointmentStatusLabel(appointment.status)}
                  </span>
                  <p className="text-[11px] text-muted-foreground">Workflow: {appointmentWorkflowPhase(appointment.status)}</p>

                  {appointment.status === "awaiting_payment" && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" className="gap-2">
                          <CreditCard className="h-4 w-4" />
                          Proceed to Payment
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Complete Payment</DialogTitle>
                          <DialogDescription>
                            Your consultation request has been approved. Please complete payment to confirm your
                            booking.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="rounded-lg border bg-muted/50 p-4">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Consultation Fee:</span>
                              <span className="font-semibold">
                                $
                                {(
                                  ((appointment.case.hourly_rate || 0) * appointment.duration_minutes) /
                                  60
                                ).toFixed(2)}
                              </span>
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground">
                              {appointment.duration_minutes} minutes @ $
                              {appointment.case.hourly_rate || 0}/hour
                            </div>
                          </div>
                          <PaymentButton
                            appointmentId={appointment.id}
                            amount={
                              ((appointment.case.hourly_rate || 0) * appointment.duration_minutes) / 60
                            }
                            onPaymentSuccess={() => {
                              // Refresh appointments
                              window.location.reload()
                            }}
                          />
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                  {appointment.status === "scheduled" && (
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="font-medium">Paid</span>
                        </div>
                        <Button variant="destructive" size="sm" onClick={() => handleCancelAppointment(appointment.id)}>
                          Cancel
                        </Button>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={processingId === appointment.id}
                        onClick={() => void handleMarkAttended(appointment.id)}
                      >
                        {processingId === appointment.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Mark Consultation Held"
                        )}
                      </Button>
                    </div>
                  )}
                  {appointment.status === "rescheduled" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={processingId === appointment.id}
                      onClick={() => void handleMarkAttended(appointment.id)}
                    >
                      {processingId === appointment.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Mark Consultation Held"
                      )}
                    </Button>
                  )}
                  {appointment.status === "attended" && (
                    <div className="text-right">
                      <p className="text-xs text-green-700 dark:text-green-400 font-medium">Consultation held</p>
                      <p className="text-xs text-muted-foreground">
                        Waiting for lawyer to request case completion
                      </p>
                    </div>
                  )}
                  {appointment.status === "pending" && (
                    <p className="text-xs text-muted-foreground text-right">Waiting for lawyer response</p>
                  )}
                  {appointment.status === "cancelled" && (
                    <p className="text-xs text-muted-foreground text-right italic">This appointment was cancelled</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
