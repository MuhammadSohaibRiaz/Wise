"use client"

import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { APPOINTMENT_SLOT_BLOCKING_STATUSES } from "@/lib/appointments-status"

interface AvailabilityCalendarProps {
  lawyerId: string
}

export function AvailabilityCalendar({ lawyerId }: AvailabilityCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [bookedSlots, setBookedSlots] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const fetchBookedSlots = async () => {
      try {
        setIsLoading(true)
        const supabase = createClient()

        const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString()

        const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString()

        const { data, error } = await supabase
          .from("appointments")
          .select("scheduled_at")
          .eq("lawyer_id", lawyerId)
          .gte("scheduled_at", monthStart)
          .lte("scheduled_at", monthEnd)
          .in("status", [...APPOINTMENT_SLOT_BLOCKING_STATUSES])

        if (error) {
          console.error("[v0] Error fetching booked slots:", error)
          return
        }

        const dates = (data || []).map((apt) => new Date(apt.scheduled_at).toISOString().split("T")[0])
        setBookedSlots(dates)
      } catch (error) {
        console.error("[v0] Unexpected error:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchBookedSlots()
  }, [lawyerId, currentDate])

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
  }

  const daysInMonth = getDaysInMonth(currentDate)
  const firstDay = getFirstDayOfMonth(currentDate)
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const blanks = Array.from({ length: firstDay }, () => null)

  const monthName = currentDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-foreground">Availability</h2>

      <div className="rounded-lg border border-border bg-card p-6">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-foreground">{monthName}</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={previousMonth} disabled={isLoading}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={nextMonth} disabled={isLoading}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-2 mb-4">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="text-center text-sm font-semibold text-muted-foreground">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2">
              {blanks.map((_, i) => (
                <div key={`blank-${i}`} />
              ))}
              {days.map((day) => {
                const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
                  .toISOString()
                  .split("T")[0]

                const hasBooking = bookedSlots.includes(dateStr)
                const isPast = new Date(dateStr) < new Date()

                return (
                  <button
                    key={day}
                    type="button"
                    disabled={isPast}
                    title={
                      hasBooking
                        ? "Has at least one booking — pick a free time slot when booking"
                        : undefined
                    }
                    className={`
                      h-10 rounded-lg font-medium text-sm transition-colors
                      ${isPast
                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                        : hasBooking
                          ? "bg-amber-100 text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100/90"
                          : "bg-primary/10 text-primary hover:bg-primary/20"
                      }
                    `}
                  >
                    {day}
                  </button>
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex gap-4 mt-6 text-xs">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-primary/10" />
                <span className="text-muted-foreground">Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-amber-100 ring-1 ring-amber-200" />
                <span className="text-muted-foreground">Partially booked</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-muted" />
                <span className="text-muted-foreground">Past</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
