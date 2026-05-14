"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, Clock, User, Loader2, CreditCard } from "lucide-react"
import { cn } from "@/lib/utils"

interface UpcomingAppointment {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: "scheduled" | "awaiting_payment" | "rescheduled" | "cancellation_requested"
  case: {
    title: string
  }
  client: {
    first_name: string | null
    last_name: string | null
  } | null
}

interface UpcomingAppointmentsProps {
  hideTitle?: boolean
}

export function UpcomingAppointments({ hideTitle = false }: UpcomingAppointmentsProps) {
  const [appointments, setAppointments] = useState<UpcomingAppointment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  const fetchAppointments = useCallback(async () => {
    try {
      setIsLoading(true)
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session?.user?.id) return

      const { data, error } = await supabase
        .from("appointments")
        .select(`
          id,
          scheduled_at,
          duration_minutes,
          status,
          cases (
            title
          ),
          profiles!appointments_client_id_fkey (
            first_name,
            last_name
          )
        `)
        .eq("lawyer_id", sessionData.session.user.id)
        .in("status", ["scheduled", "awaiting_payment", "rescheduled", "cancellation_requested"])
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(3)

      if (error) throw error

      setAppointments(
        (data || []).map((apt: any) => ({
          id: apt.id,
          scheduled_at: apt.scheduled_at,
          duration_minutes: apt.duration_minutes,
          status: apt.status,
          case: apt.cases || { title: "Legal Consultation" },
          client: apt.profiles || null,
        }))
      )
    } catch (error) {
      console.error("[UpcomingAppointments] Fetch error:", error)
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    void fetchAppointments()

    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    const setup = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      if (cancelled || !sessionData.session?.user?.id) return
      const lid = sessionData.session.user.id
      const topic = `lawyer-upcoming-apts-${lid}-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())}`
      channel = supabase
        .channel(topic)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "appointments",
            filter: `lawyer_id=eq.${lid}`,
          },
          () => {
            void fetchAppointments()
          },
        )
        .subscribe()
    }

    void setup()

    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [fetchAppointments, supabase])

  if (isLoading) {
    return (
      <div className="space-y-4">
        {!hideTitle && <h2 className="text-xl font-bold">Upcoming Appointments</h2>}
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (appointments.length === 0) return null

  return (
    <div className="space-y-4">
      {!hideTitle && (
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Upcoming Appointments</h2>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs" 
            onClick={() => router.push("/lawyer/appointments")}
          >
            View all
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {appointments.map((apt) => (
          <Card key={apt.id} className="overflow-hidden border-l-4 border-l-primary hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">
                      {apt.client ? `${apt.client.first_name} ${apt.client.last_name}` : "Unknown Client"}
                    </span>
                  </div>
                  
                  <p className="text-sm font-medium line-clamp-1">{apt.case.title}</p>

                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(apt.scheduled_at).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(apt.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <Badge 
                    variant={apt.status === "scheduled" ? "default" : "secondary"}
                    className={cn(
                      "text-[10px] uppercase tracking-wider",
                      apt.status === "awaiting_payment" && "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
                      apt.status === "rescheduled" && "bg-indigo-100 text-indigo-700 hover:bg-indigo-100",
                      apt.status === "cancellation_requested" && "bg-amber-100 text-amber-700 hover:bg-amber-100",
                    )}
                  >
                    {apt.status === "awaiting_payment" ? (
                      <div className="flex items-center gap-1">
                        <CreditCard className="h-3 w-3" />
                        Awaiting Payment
                      </div>
                    ) : apt.status === "rescheduled" ? "Rescheduled"
                      : apt.status === "cancellation_requested" ? "Under Review"
                      : "Confirmed"}
                  </Badge>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-8 text-xs"
                    onClick={() => router.push("/lawyer/appointments")}
                  >
                    Details
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
