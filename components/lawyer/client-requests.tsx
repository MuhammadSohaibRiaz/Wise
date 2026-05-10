"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, MapPin, User, Check, X, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { notifyAppointmentUpdate } from "@/lib/notifications"
import { appendCaseTimelineEvent, CaseTimelineEventType } from "@/lib/case-timeline"

interface AppointmentRequest {
  id: string
  scheduled_at: string
  duration_minutes: number
  request_message?: string
  client_id: string
  case_id: string
  case: {
    title: string
    case_type: string
  }
  client: {
    first_name: string
    last_name: string
    location?: string
  }
  created_at: string
}

interface ClientRequestsProps {
  hideTitle?: boolean
}

export function ClientRequests({ hideTitle = false }: ClientRequestsProps) {
  const [requests, setRequests] = useState<AppointmentRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [lawyerId, setLawyerId] = useState<string | null>(null)
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    let activeChannel: any = null
    let isCancelled = false

    const fetchRequests = async () => {
      try {
        setIsLoading(true)

        const { data: sessionData } = await supabase.auth.getSession()
        if (!sessionData.session?.user?.id) {
          return
        }
        setLawyerId(sessionData.session.user.id)

        const { data, error } = await supabase
          .from("appointments")
          .select(
            `
            id,
            case_id,
            client_id,
            scheduled_at,
            duration_minutes,
            request_message,
            created_at,
            cases (
              title,
              case_type
            ),
            profiles!appointments_client_id_fkey (
              first_name,
              last_name,
              location
            )
          `,
          )
          .eq("lawyer_id", sessionData.session.user.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(5)

        if (error) throw error

        setRequests(
          (data || []).map((apt: any) => ({
            id: apt.id,
            case_id: apt.case_id,
            client_id: apt.client_id,
            scheduled_at: apt.scheduled_at,
            duration_minutes: apt.duration_minutes,
            request_message: apt.request_message,
            case: apt.cases || {},
            client: apt.profiles || {},
            created_at: apt.created_at,
          })),
        )
      } catch (error) {
        console.error("[v0] Error fetching requests:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchRequests()

    // Set up real-time subscription
    const setupRealtime = async () => {
      const { data } = await supabase.auth.getSession()

      if (!data.session?.user?.id) return null
      const userId = data.session.user.id
      const channelName = `client-requests-changes-${userId}`
      const existing = supabase.getChannels().filter((ch) => ch.topic === `realtime:${channelName}`)
      await Promise.all(existing.map((ch) => supabase.removeChannel(ch)))

      const channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "appointments",
            filter: `lawyer_id=eq.${userId}`,
          },
          () => {
            fetchRequests()
          },
        )
        .subscribe()

      if (!isCancelled) {
        activeChannel = channel
      } else {
        supabase.removeChannel(channel)
      }
    }

    setupRealtime()

    return () => {
      isCancelled = true
      if (activeChannel) {
        supabase.removeChannel(activeChannel)
      }
    }
  }, [])

  const handleAccept = async (requestId: string) => {
    try {
      setProcessingId(requestId)
      const supabase = createClient()
      const target = requests.find((r) => r.id === requestId)

      if (!target || !lawyerId) {
        throw new Error("Request data missing")
      }

      const { data: scheduledAppointments, error: scheduleError } = await supabase
        .from("appointments")
        .select("id, scheduled_at, duration_minutes")
        .eq("lawyer_id", lawyerId)
        .in("status", ["scheduled", "rescheduled", "awaiting_payment", "attended"])
        .neq("id", requestId)

      if (scheduleError) throw scheduleError

      const slotStart = new Date(target.scheduled_at)
      const slotEnd = new Date(slotStart.getTime() + target.duration_minutes * 60000)
      const hasConflict = (scheduledAppointments || []).some((apt) => {
        const aptStart = new Date(apt.scheduled_at)
        const aptEnd = new Date(aptStart.getTime() + apt.duration_minutes * 60000)
        return !(slotEnd <= aptStart || slotStart >= aptEnd)
      })

      if (hasConflict) {
        toast({
          title: "Schedule conflict",
          description: "You already have an appointment during this slot. Please propose a different time.",
          variant: "destructive",
        })
        return
      }

      const { error } = await supabase
        .from("appointments")
        .update({
          status: "awaiting_payment",
          responded_at: new Date().toISOString(),
        })
        .eq("id", requestId)

      if (error) throw error

      setRequests(requests.filter((r) => r.id !== requestId))

      await notifyAppointmentUpdate(
        supabase,
        "lawyer_accept",
        {
          recipientId: target.client_id,
          actorId: lawyerId,
          caseTitle: target.case.title,
          scheduledAt: target.scheduled_at,
          appointmentId: requestId,
          caseId: target.case_id,
        },
      )

      await appendCaseTimelineEvent(supabase, {
        caseId: target.case_id,
        actorId: lawyerId,
        eventType: CaseTimelineEventType.CONSULTATION_ACCEPTED,
        metadata: {
          appointment_id: requestId,
          previous_status: "pending",
          status_after: "awaiting_payment",
          action: "lawyer_accepted",
          source: "client_requests_widget",
        },
      })

      toast({
        title: "Request Accepted",
        description: "The client will be notified to complete payment.",
      })
    } catch (error) {
      console.error("[v0] Accept error:", error)
      toast({
        title: "Error",
        description: "Failed to accept request.",
        variant: "destructive",
      })
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (requestId: string) => {
    try {
      setProcessingId(requestId)
      const supabase = createClient()
      const target = requests.find((r) => r.id === requestId)

      if (!target || !lawyerId) {
        throw new Error("Request data missing")
      }

      const { error } = await supabase
        .from("appointments")
        .update({
          status: "rejected",
          responded_at: new Date().toISOString(),
        })
        .eq("id", requestId)

      if (error) throw error

      await supabase
        .from("cases")
        .update({
          lawyer_id: null,
          status: "open",
          updated_at: new Date().toISOString(),
        })
        .eq("id", target.case_id)

      setRequests(requests.filter((r) => r.id !== requestId))

      await notifyAppointmentUpdate(
        supabase,
        "lawyer_reject",
        {
          recipientId: target.client_id,
          actorId: lawyerId,
          caseTitle: target.case.title,
          appointmentId: requestId,
          caseId: target.case_id,
        },
      )

      await appendCaseTimelineEvent(supabase, {
        caseId: target.case_id,
        actorId: lawyerId,
        eventType: CaseTimelineEventType.LAWYER_REJECTED_CONSULTATION,
        metadata: {
          appointment_id: requestId,
          previous_status: "pending",
          status_after: "rejected",
          action: "lawyer_rejected",
          source: "client_requests_widget",
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
        description: "Failed to reject request.",
        variant: "destructive",
      })
    } finally {
      setProcessingId(null)
    }
  }

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

    if (diffInHours < 1) return "Just now"
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} ago`
    const diffInDays = Math.floor(diffInHours / 24)
    return `${diffInDays} day${diffInDays > 1 ? "s" : ""} ago`
  }

  if (isLoading) {
    return (
      <div className="space-y-3 md:space-y-4">
        {!hideTitle && (
          <div className="flex items-center justify-between">
            <h2 className="text-xl md:text-2xl font-bold">Client Requests</h2>
          </div>
        )}
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 md:space-y-4">
      {!hideTitle && (
        <div className="flex items-center justify-between">
          <h2 className="text-xl md:text-2xl font-bold">Client Requests</h2>
          {requests.length > 0 && (
            <Badge className="bg-orange-500/20 text-orange-700 dark:text-orange-400 text-xs">
              {requests.length} New
            </Badge>
          )}
          {requests.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => router.push("/lawyer/appointments")}
            >
              View All
            </Button>
          )}
        </div>
      )}

      {requests.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-sm text-muted-foreground">No pending appointment requests</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <Card
              key={request.id}
              className="p-3 md:p-4 border-l-4 border-l-orange-500 hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col md:flex-row items-start justify-between gap-3 md:gap-4">
                <div className="flex-1 w-full">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold text-sm md:text-base">
                      {request.client.first_name} {request.client.last_name}
                    </h3>
                  </div>
                  <p className="text-xs md:text-sm font-medium mb-1">{request.case.title || "Consultation"}</p>
                  <p className="text-xs md:text-sm text-muted-foreground mb-2">
                    {request.case.case_type || "General"}
                  </p>
                  {request.request_message && (
                    <p className="text-xs md:text-sm mb-3 line-clamp-2">{request.request_message}</p>
                  )}

                  <div className="flex gap-3 md:gap-4 text-xs text-muted-foreground flex-wrap">
                    {request.client.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {request.client.location}
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {getTimeAgo(request.created_at)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(request.scheduled_at).toLocaleDateString()} at{" "}
                      {new Date(request.scheduled_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex md:flex-col items-center md:items-end justify-between md:justify-start w-full md:w-auto gap-3">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs md:text-sm bg-transparent text-destructive border-destructive hover:bg-destructive hover:text-white"
                      onClick={() => handleReject(request.id)}
                      disabled={processingId === request.id}
                    >
                      {processingId === request.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <X className="h-3 w-3 mr-1" />
                          Decline
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      className="text-xs md:text-sm bg-green-600 hover:bg-green-700"
                      onClick={() => handleAccept(request.id)}
                      disabled={processingId === request.id}
                    >
                      {processingId === request.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <Check className="h-3 w-3 mr-1" />
                          Accept
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
