"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { DayPicker } from "react-day-picker"
import { format, isPast, startOfDay, addDays } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, AlertCircle, Calendar, Clock, FileText, CreditCard, CheckCircle2, XCircle, CalendarClock, MessageSquare } from "lucide-react"
import { appointmentStatusLabel, appointmentWorkflowPhase } from "@/lib/appointments-status"
import { PaymentButton } from "@/components/payments/payment-button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import "react-day-picker/dist/style.css"

interface Appointment {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: "pending" | "awaiting_payment" | "scheduled" | "attended" | "completed" | "cancelled" | "rescheduled" | "rejected" | "cancellation_requested"
  payment_status?: "pending" | "completed" | "failed" | null
  reschedule_count: number
  case: {
    id: string
    title: string
    case_type: string
    hourly_rate: number | null
    status?: string
  }
  lawyer: {
    id: string
    first_name: string
    last_name: string
    avatar_url: string | null
  }
}

const TIME_SLOTS = Array.from({ length: 17 }, (_, i) => {
  const hour = Math.floor(i / 2) + 9
  const min = i % 2 === 0 ? "00" : "30"
  return `${String(hour).padStart(2, "0")}:${min}`
})

export default function ClientAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clientId, setClientId] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const { toast } = useToast()
  const searchParams = useSearchParams()

  // Reschedule state
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>(undefined)
  const [rescheduleTime, setRescheduleTime] = useState("")
  const [rescheduleError, setRescheduleError] = useState("")

  // Cancel state
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null)

  // Support ticket state
  const [supportTarget, setSupportTarget] = useState<Appointment | null>(null)
  const [supportMessage, setSupportMessage] = useState("")
  const [supportSubmitting, setSupportSubmitting] = useState(false)

  useEffect(() => {
    const paymentStatus = searchParams.get("payment")
    const sessionId = searchParams.get("session_id")

    if (paymentStatus === "success" && sessionId) {
      const verifyPayment = async () => {
        try {
          const response = await fetch("/api/stripe/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }),
          })

          if (response.ok) {
            toast({
              title: "Payment Successful",
              description: "Your appointment has been confirmed. Refreshing...",
            })
            setTimeout(() => {
              window.location.href = "/client/appointments"
            }, 2000)
          } else {
            toast({
              title: "Payment Processing",
              description: "Your payment is being processed. The page will refresh shortly.",
            })
            setTimeout(() => {
              window.location.href = "/client/appointments"
            }, 3000)
          }
        } catch {
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
            reschedule_count,
            cases (
              id,
              title,
              case_type,
              hourly_rate,
              status
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
          payment_status: paymentStatuses[apt.case_id] || null,
          reschedule_count: apt.reschedule_count || 0,
          case: apt.cases || { id: "", title: "", case_type: "", hourly_rate: null, status: "" },
          lawyer: apt.profiles || {},
        }))

        setAppointments(mappedAppointments)
      } catch (error) {
        console.error("[Client Appointments] Fetch error:", error)
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

  useEffect(() => {
    if (!clientId) return

    const supabase = createClient()
    let refetchTimeout: ReturnType<typeof setTimeout> | null = null
    const debouncedRefetch = () => {
      if (refetchTimeout) clearTimeout(refetchTimeout)
      refetchTimeout = setTimeout(() => {
        window.location.reload()
      }, 500)
    }

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
          const updated = payload.new as any
          setAppointments((prev) =>
            prev.map((apt) =>
              apt.id === updated.id
                ? { ...apt, status: updated.status, scheduled_at: updated.scheduled_at || apt.scheduled_at, reschedule_count: updated.reschedule_count ?? apt.reschedule_count }
                : apt,
            ),
          )
          if (updated.status === "awaiting_payment") {
            toast({
              title: "Payment Required",
              description: "Your appointment has been approved. Please complete payment to confirm your booking.",
            })
          } else if (updated.status === "scheduled") {
            toast({
              title: "Appointment Confirmed",
              description: "Your payment was successful and your appointment is now confirmed.",
            })
          } else if (updated.status === "rescheduled") {
            toast({
              title: "Appointment Rescheduled",
              description: "Your appointment has been rescheduled. Check the new time.",
            })
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "appointments", filter: `client_id=eq.${clientId}` },
        () => debouncedRefetch(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments", filter: `client_id=eq.${clientId}` },
        () => debouncedRefetch(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "cases", filter: `client_id=eq.${clientId}` },
        (payload) => {
          const updatedCase = payload.new as any
          setAppointments((prev) =>
            prev.map((apt) =>
              apt.case.id === updatedCase.id
                ? { ...apt, case: { ...apt.case, status: updatedCase.status } }
                : apt,
            ),
          )
          if (updatedCase.status === "pending_completion") {
            toast({
              title: "Completion Requested",
              description: "Your lawyer has requested case completion. Please review from My Cases.",
            })
          }
        },
      )
      .subscribe()

    return () => {
      if (refetchTimeout) clearTimeout(refetchTimeout)
      supabase.removeChannel(channel)
    }
  }, [clientId, toast])

  // --- Handlers ---

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

  const handleCancelAppointment = async (appointmentId: string) => {
    try {
      setProcessingId(appointmentId)
      const res = await fetch("/api/appointments/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointment_id: appointmentId }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(json.error || "Failed to cancel appointment")
      setAppointments((prev) =>
        prev.map((apt) => (apt.id === appointmentId ? { ...apt, status: "cancelled" as const } : apt)),
      )
      setCancelTarget(null)
      toast({ title: "Appointment Cancelled", description: "Your appointment has been cancelled successfully." })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to cancel appointment"
      toast({ title: "Error", description: message, variant: "destructive" })
    } finally {
      setProcessingId(null)
    }
  }

  const handleReschedule = async () => {
    if (!rescheduleTarget || !rescheduleDate || !rescheduleTime) {
      setRescheduleError("Please select both a date and time.")
      return
    }

    const [hours, minutes] = rescheduleTime.split(":").map(Number)
    const newDateTime = new Date(rescheduleDate)
    newDateTime.setHours(hours, minutes, 0, 0)

    setRescheduleError("")
    setProcessingId(rescheduleTarget.id)

    try {
      const res = await fetch("/api/appointments/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointment_id: rescheduleTarget.id,
          new_scheduled_at: newDateTime.toISOString(),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Failed to reschedule")

      setAppointments((prev) =>
        prev.map((apt) =>
          apt.id === rescheduleTarget.id
            ? {
                ...apt,
                status: "rescheduled" as const,
                scheduled_at: newDateTime.toISOString(),
                reschedule_count: json.reschedule_count ?? apt.reschedule_count + 1,
              }
            : apt,
        ),
      )
      setRescheduleTarget(null)
      setRescheduleDate(undefined)
      setRescheduleTime("")
      toast({ title: "Appointment rescheduled successfully", description: `New time: ${format(newDateTime, "PPP 'at' p")}` })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to reschedule"
      setRescheduleError(message)
    } finally {
      setProcessingId(null)
    }
  }

  const handleSupportTicket = async () => {
    if (!supportTarget) return
    setSupportSubmitting(true)
    try {
      const res = await fetch("/api/appointments/support-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointment_id: supportTarget.id,
          message: supportMessage,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Failed to submit request")

      setAppointments((prev) =>
        prev.map((apt) =>
          apt.id === supportTarget.id ? { ...apt, status: "cancellation_requested" as const } : apt,
        ),
      )
      setSupportTarget(null)
      setSupportMessage("")
      toast({
        title: "Request Submitted",
        description: "Your request has been submitted. We'll review and contact you within 24 hours.",
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to submit"
      toast({ title: "Error", description: message, variant: "destructive" })
    } finally {
      setSupportSubmitting(false)
    }
  }

  const canReschedule = (apt: Appointment) =>
    (apt.status === "scheduled" || apt.status === "rescheduled") &&
    apt.reschedule_count < 3 &&
    new Date(apt.scheduled_at).getTime() - Date.now() > 2 * 60 * 60 * 1000

  const canCancelPrePayment = (apt: Appointment) =>
    apt.status === "pending" || apt.status === "awaiting_payment"

  const isPaidAppointment = (apt: Appointment) =>
    apt.status === "scheduled" || apt.status === "rescheduled"

  // --- Render helpers ---

  const statusBorderClass = (status: string) => {
    switch (status) {
      case "cancelled": return "border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900/50 opacity-75"
      case "pending": return "border-orange-200 bg-orange-50/30 dark:bg-orange-950/20 dark:border-orange-800/50"
      case "awaiting_payment": return "border-yellow-200 bg-yellow-50/30 dark:bg-yellow-950/20 dark:border-yellow-800/50 shadow-sm"
      case "scheduled": return "border-blue-200 bg-blue-50/30 dark:bg-blue-950/20 dark:border-blue-800/50 shadow-sm"
      case "rescheduled": return "border-indigo-200 bg-indigo-50/30 dark:bg-indigo-950/20 dark:border-indigo-800/50 shadow-sm"
      case "attended": case "completed": return "border-green-200 bg-green-50/30 dark:bg-green-950/20 dark:border-green-800/50"
      case "rejected": return "border-red-200 bg-red-50/30 dark:bg-red-950/20 dark:border-red-800/50"
      case "cancellation_requested": return "border-amber-300 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-700/50 shadow-sm"
      default: return "border-border bg-card"
    }
  }

  const statusBadgeClass = (status: string) => {
    switch (status) {
      case "pending": return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border border-orange-200 dark:border-orange-800"
      case "awaiting_payment": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800"
      case "scheduled": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
      case "rescheduled": return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
      case "attended": case "completed": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-800"
      case "rejected": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800"
      case "cancelled": return "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
      case "cancellation_requested": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
      default: return "bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-300"
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
              className={`rounded-lg border ${statusBorderClass(appointment.status)} p-6 transition-all hover:shadow-md`}
            >
              {/* Cancellation requested banner */}
              {appointment.status === "cancellation_requested" && (
                <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 px-4 py-3">
                  <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    Cancellation requested &mdash; under admin review. Please wait for admin to resolve this.
                  </p>
                </div>
              )}

              <div className="flex items-start justify-between gap-4">
                <div className="space-y-4 flex-1">
                  <div className="flex items-center gap-3">
                    {appointment.lawyer.avatar_url ? (
                      <img
                        src={appointment.lawyer.avatar_url || "/placeholder.svg"}
                        alt={`${appointment.lawyer.first_name} ${appointment.lawyer.last_name}`}
                        className={`h-10 w-10 rounded-full object-cover ${appointment.status === "cancelled" ? "opacity-50 grayscale" : ""}`}
                      />
                    ) : (
                      <div className={`h-10 w-10 rounded-full bg-muted flex items-center justify-center ${appointment.status === "cancelled" ? "opacity-50" : ""}`}>
                        <span className="text-sm font-medium text-muted-foreground">
                          {appointment.lawyer.first_name?.charAt(0)}
                          {appointment.lawyer.last_name?.charAt(0)}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className={`font-medium ${appointment.status === "cancelled" ? "text-muted-foreground line-through" : ""}`}>
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
                          {new Date(appointment.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{" "}
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
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass(appointment.status)}`}>
                    {appointmentStatusLabel(appointment.status)}
                  </span>
                  <p className="text-[11px] text-muted-foreground">Workflow: {appointmentWorkflowPhase(appointment.status)}</p>

                  {/* Awaiting Payment */}
                  {appointment.status === "awaiting_payment" && (
                    <>
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
                              Your consultation request has been approved. Please complete payment to confirm your booking.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="rounded-lg border bg-muted/50 p-4">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Consultation Fee:</span>
                                <span className="font-semibold">
                                  ${(((appointment.case.hourly_rate || 0) * appointment.duration_minutes) / 60).toFixed(2)}
                                </span>
                              </div>
                              <div className="mt-2 text-xs text-muted-foreground">
                                {appointment.duration_minutes} minutes @ ${appointment.case.hourly_rate || 0}/hour
                              </div>
                            </div>
                            <PaymentButton
                              appointmentId={appointment.id}
                              amount={((appointment.case.hourly_rate || 0) * appointment.duration_minutes) / 60}
                              onPaymentSuccess={() => window.location.reload()}
                            />
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive border-destructive hover:bg-destructive hover:text-white"
                        disabled={processingId === appointment.id}
                        onClick={() => setCancelTarget(appointment)}
                      >
                        {processingId === appointment.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><XCircle className="h-4 w-4 mr-1" />Cancel</>}
                      </Button>
                    </>
                  )}

                  {/* Pending */}
                  {appointment.status === "pending" && (
                    <>
                      <p className="text-xs text-muted-foreground text-right">Waiting for lawyer response</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive border-destructive hover:bg-destructive hover:text-white"
                        disabled={processingId === appointment.id}
                        onClick={() => setCancelTarget(appointment)}
                      >
                        {processingId === appointment.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><XCircle className="h-4 w-4 mr-1" />Cancel</>}
                      </Button>
                    </>
                  )}

                  {/* Scheduled */}
                  {appointment.status === "scheduled" && (
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="font-medium">Paid & Confirmed</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={processingId === appointment.id}
                        onClick={() => void handleMarkAttended(appointment.id)}
                      >
                        {processingId === appointment.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mark Consultation Held"}
                      </Button>
                      {canReschedule(appointment) ? (
                        <Button size="sm" variant="outline" onClick={() => { setRescheduleTarget(appointment); setRescheduleError("") }}>
                          <CalendarClock className="h-4 w-4 mr-1" />
                          Reschedule ({3 - appointment.reschedule_count} left)
                        </Button>
                      ) : appointment.reschedule_count >= 3 ? (
                        <p className="text-xs text-muted-foreground text-right max-w-[200px]">
                          Maximum reschedules reached.{" "}
                          <button className="text-primary underline" onClick={() => { setSupportTarget(appointment); setSupportMessage("") }}>Contact Support</button>
                        </p>
                      ) : null}
                      <button className="text-xs text-muted-foreground hover:text-primary underline" onClick={() => { setSupportTarget(appointment); setSupportMessage("") }}>
                        Need to cancel? Contact Support
                      </button>
                    </div>
                  )}

                  {/* Rescheduled */}
                  {appointment.status === "rescheduled" && (
                    <div className="flex flex-col items-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={processingId === appointment.id}
                        onClick={() => void handleMarkAttended(appointment.id)}
                      >
                        {processingId === appointment.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mark Consultation Held"}
                      </Button>
                      {canReschedule(appointment) ? (
                        <Button size="sm" variant="outline" onClick={() => { setRescheduleTarget(appointment); setRescheduleError("") }}>
                          <CalendarClock className="h-4 w-4 mr-1" />
                          Reschedule ({3 - appointment.reschedule_count} left)
                        </Button>
                      ) : appointment.reschedule_count >= 3 ? (
                        <p className="text-xs text-muted-foreground text-right max-w-[200px]">
                          Maximum reschedules reached.{" "}
                          <button className="text-primary underline" onClick={() => { setSupportTarget(appointment); setSupportMessage("") }}>Contact Support</button>
                        </p>
                      ) : null}
                      <button className="text-xs text-muted-foreground hover:text-primary underline" onClick={() => { setSupportTarget(appointment); setSupportMessage("") }}>
                        Need to cancel? Contact Support
                      </button>
                    </div>
                  )}

                  {/* Cancellation Requested */}
                  {appointment.status === "cancellation_requested" && (
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-medium text-right">Under admin review</p>
                  )}

                  {/* Attended */}
                  {appointment.status === "attended" && (
                    <div className="text-right">
                      <p className="text-xs text-green-700 dark:text-green-400 font-medium">Consultation held</p>
                      {appointment.case.status === "pending_completion" ? (
                        <a href={`/client/cases/${appointment.case.id}`} className="block mt-1">
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 dark:bg-purple-900/30 px-2.5 py-1 text-xs font-semibold text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-200 transition-colors">
                            <CheckCircle2 className="h-3 w-3" />
                            Completion requested — Review now
                          </span>
                        </a>
                      ) : appointment.case.status === "completed" ? (
                        <p className="text-xs text-green-700 dark:text-green-400 font-medium mt-1">Case completed</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Waiting for lawyer to request case completion</p>
                      )}
                    </div>
                  )}

                  {/* Cancelled */}
                  {appointment.status === "cancelled" && (
                    <p className="text-xs text-muted-foreground text-right italic">This appointment was cancelled</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reschedule Modal */}
      <Dialog open={!!rescheduleTarget} onOpenChange={(open) => { if (!open) { setRescheduleTarget(null); setRescheduleError("") } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reschedule Appointment</DialogTitle>
            <DialogDescription>
              Select a new date and time for your consultation
              {rescheduleTarget ? ` with ${rescheduleTarget.lawyer.first_name} ${rescheduleTarget.lawyer.last_name}` : ""}.
              {rescheduleTarget && ` (${3 - rescheduleTarget.reschedule_count} reschedule${3 - rescheduleTarget.reschedule_count === 1 ? "" : "s"} remaining)`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-center">
              <DayPicker
                mode="single"
                selected={rescheduleDate}
                onSelect={(d) => { setRescheduleDate(d ?? undefined); setRescheduleError("") }}
                disabled={(date) => isPast(startOfDay(date)) || date < addDays(new Date(), 1) || date > addDays(new Date(), 60)}
                className="rounded-md border"
              />
            </div>
            {rescheduleDate && (
              <div>
                <label className="text-sm font-medium mb-1 block">Select Time</label>
                <Select value={rescheduleTime} onValueChange={(v) => { setRescheduleTime(v); setRescheduleError("") }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a time slot" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.map((slot) => (
                      <SelectItem key={slot} value={slot}>
                        {slot}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {rescheduleError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {rescheduleError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleTarget(null)}>Cancel</Button>
            <Button
              onClick={handleReschedule}
              disabled={!rescheduleDate || !rescheduleTime || processingId === rescheduleTarget?.id}
            >
              {processingId === rescheduleTarget?.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm Reschedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirm Dialog */}
      <Dialog open={!!cancelTarget} onOpenChange={(open) => { if (!open) setCancelTarget(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Appointment</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this appointment? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>Keep Appointment</Button>
            <Button
              variant="destructive"
              disabled={processingId === cancelTarget?.id}
              onClick={() => cancelTarget && handleCancelAppointment(cancelTarget.id)}
            >
              {processingId === cancelTarget?.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Yes, Cancel Appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Support Ticket Dialog */}
      <Dialog open={!!supportTarget} onOpenChange={(open) => { if (!open) { setSupportTarget(null); setSupportMessage("") } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Contact Support
            </DialogTitle>
            <DialogDescription>
              Submit a cancellation request for your paid appointment. An admin will review your request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Appointment:</span>
                <span className="font-medium">{supportTarget?.id.slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Case:</span>
                <span className="font-medium">{supportTarget?.case.title || "N/A"}</span>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Describe your issue <span className="text-destructive">*</span></label>
              <Textarea
                value={supportMessage}
                onChange={(e) => setSupportMessage(e.target.value)}
                placeholder="Please explain why you need to cancel this appointment (min 20 characters)..."
                rows={4}
              />
              {supportMessage.length > 0 && supportMessage.length < 20 && (
                <p className="text-xs text-destructive mt-1">{20 - supportMessage.length} more characters needed</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSupportTarget(null)}>Cancel</Button>
            <Button
              onClick={handleSupportTicket}
              disabled={supportMessage.trim().length < 20 || supportSubmitting}
            >
              {supportSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
