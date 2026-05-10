"use client"

import { useState, useEffect } from "react"
import { DayPicker } from "react-day-picker"
import { format, isPast, isSameDay, startOfDay, addHours, setHours, setMinutes } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { notifyAppointmentRequest } from "@/lib/notifications"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Calendar, Clock, FileText, AlertCircle, CheckCircle } from "lucide-react"
import "react-day-picker/dist/style.css"

interface BookAppointmentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lawyerId: string
  lawyerName: string
  hourlyRate: number
  clientId?: string
  onBookingSuccess?: () => void
}

export function BookAppointmentModal({
  open,
  onOpenChange,
  lawyerId,
  lawyerName,
  hourlyRate,
  clientId,
  onBookingSuccess,
}: BookAppointmentModalProps) {
  const [step, setStep] = useState<"select-date" | "case-details" | "confirm" | "success">("select-date")
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string>("")
  const [duration, setDuration] = useState<30 | 60 | 90>(60)
  const [caseType, setCaseType] = useState("")
  const [caseTitle, setCaseTitle] = useState("")
  const [caseDescription, setCaseDescription] = useState("")
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [bookedDates, setBookedDates] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [bookedAppointmentId, setBookedAppointmentId] = useState<string | null>(null)
  const { toast } = useToast()

  const supabase = createClient()

  // Fetch booked dates for calendar
  useEffect(() => {
    const fetchBookedDates = async () => {
      try {
        const { data, error } = await supabase
          .from("appointments")
          .select("scheduled_at")
          .eq("lawyer_id", lawyerId)
          .in("status", ["scheduled", "attended", "completed", "pending", "awaiting_payment"])
          .gte("scheduled_at", new Date().toISOString())

        if (error) {
          console.error("[v0] Error fetching booked dates:", error)
          return
        }

        const dates = (data || []).map((apt) => new Date(apt.scheduled_at).toISOString().split("T")[0])
        setBookedDates(dates)
      } catch (error) {
        console.error("[v0] Unexpected error fetching booked dates:", error)
      }
    }

    if (open) {
      fetchBookedDates()
      
      // Load AI summary if available for auto-filling
      if (typeof window !== "undefined") {
        const aiSummary = sessionStorage.getItem("active_analysis_summary")
        if (aiSummary && !caseDescription) {
          setCaseDescription(aiSummary)
          console.log("[Booking] Auto-filled case description from AI summary")
        }
      }
    }
  }, [open, lawyerId, supabase])

  // Fetch available slots when date is selected
  useEffect(() => {
    if (!selectedDate) {
      setAvailableSlots([])
      setSelectedTime("")
      return
    }

    const fetchAvailableSlots = async () => {
      try {
        setIsLoadingSlots(true)
        const dateStr = selectedDate.toISOString().split("T")[0]
        const now = new Date()
        const isToday = isSameDay(selectedDate, now)

        // Get booked appointments for this lawyer on selected date
        const { data: booked, error } = await supabase
          .from("appointments")
          .select("scheduled_at, duration_minutes")
          .eq("lawyer_id", lawyerId)
          .gte("scheduled_at", `${dateStr}T00:00:00`)
          .lte("scheduled_at", `${dateStr}T23:59:59`)
          .in("status", ["scheduled", "attended", "completed", "pending", "awaiting_payment"])

        if (error) throw error

        // Generate 30-minute slots throughout the day (9 AM to 6 PM)
        const slots: string[] = []
        const startHour = 9
        const endHour = 18

        for (let hour = startHour; hour < endHour; hour++) {
          for (let minute = 0; minute < 60; minute += 30) {
            const slotTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
            const slotDateTime = new Date(selectedDate)
            slotDateTime.setHours(hour, minute, 0, 0)

            // Skip past times if it's today
            if (isToday && slotDateTime <= now) {
              continue
            }

            // Check if slot conflicts with booked appointments
            const isBooked = booked?.some((apt) => {
              const aptDate = new Date(apt.scheduled_at)
              const aptHour = aptDate.getHours()
              const aptMinute = aptDate.getMinutes()
              const aptEndTime = new Date(aptDate.getTime() + apt.duration_minutes * 60000)
              const aptEndHour = aptEndTime.getHours()
              const aptEndMinute = aptEndTime.getMinutes()

              const slotEndTime = new Date(slotDateTime.getTime() + duration * 60000)

              // Check for overlap
              return !(slotEndTime <= aptDate || slotDateTime >= aptEndTime)
            })

            if (!isBooked && hour < endHour - 1) {
              slots.push(slotTime)
            }
          }
        }

        setAvailableSlots(slots)
      } catch (error) {
        console.error("[v0] Failed to fetch slots:", error)
        toast({
          title: "Error",
          description: "Failed to fetch available slots.",
          variant: "destructive",
        })
      } finally {
        setIsLoadingSlots(false)
      }
    }

    fetchAvailableSlots()
  }, [selectedDate, duration, lawyerId, supabase, toast])

  const handleRequestAppointment = async () => {
    if (!selectedDate || !selectedTime || !caseType || !caseTitle || !clientId) {
      toast({
        title: "Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      })
      return
    }

    // Validate client ID
    if (!clientId) {
      toast({
        title: "Error",
        description: "You must be logged in to book an appointment. Please sign in first.",
        variant: "destructive",
      })
      return
    }

    // Validate hourly rate
    if (!hourlyRate || hourlyRate <= 0) {
      toast({
        title: "Error",
        description: "Lawyer's hourly rate is not set. Please contact the lawyer directly.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsLoading(true)

      // Verify user is authenticated
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user || user.id !== clientId) {
        throw new Error("Authentication failed. Please sign in again.")
      }

      // Combine date and time
      const [hours, minutes] = selectedTime.split(":")
      const appointmentDateTime = new Date(selectedDate)
      appointmentDateTime.setHours(Number.parseInt(hours), Number.parseInt(minutes), 0)

      // Validate appointment is in the future
      if (appointmentDateTime <= new Date()) {
        toast({
          title: "Error",
          description: "Please select a future date and time.",
          variant: "destructive",
        })
        setIsLoading(false)
        return
      }

          const dayStart = new Date(appointmentDateTime)
          dayStart.setHours(0, 0, 0, 0)
          const dayEnd = new Date(dayStart)
          dayEnd.setDate(dayEnd.getDate() + 1)

          const { data: conflictingAppointments, error: conflictsError } = await supabase
            .from("appointments")
            .select("id, scheduled_at, duration_minutes")
            .eq("lawyer_id", lawyerId)
            .in("status", ["pending", "scheduled"])
            .gte("scheduled_at", dayStart.toISOString())
            .lt("scheduled_at", dayEnd.toISOString())

          if (conflictsError) throw conflictsError

          const slotStart = appointmentDateTime
          const slotEnd = new Date(slotStart.getTime() + duration * 60000)
          const overlaps = (conflictingAppointments || []).some((apt) => {
            const aptStart = new Date(apt.scheduled_at)
            const aptEnd = new Date(aptStart.getTime() + apt.duration_minutes * 60000)
            return !(slotEnd <= aptStart || slotStart >= aptEnd)
          })

          if (overlaps) {
            toast({
              title: "Slot unavailable",
              description: "The selected time got booked by someone else. Please choose a different slot.",
              variant: "destructive",
            })
            setIsLoading(false)
            return
          }

          // Create case first
      const { data: caseData, error: caseError } = await supabase
        .from("cases")
        .insert({
          client_id: clientId,
          lawyer_id: lawyerId,
          title: caseTitle,
          description: caseDescription,
          case_type: caseType,
          status: "open",
          hourly_rate: hourlyRate,
        })
        .select()
        .single()

      if (caseError) throw caseError
      if (!caseData) throw new Error("Failed to create case")

      // 1.5. Link existing analysis document if present
      if (typeof window !== "undefined") {
        const activeDocId = sessionStorage.getItem("active_analysis_doc_id")
        if (activeDocId) {
          console.log("[Booking] Found active analysis document, linking to new case:", activeDocId)
          const { error: linkError } = await supabase
            .from("documents")
            .update({ case_id: caseData.id })
            .eq("id", activeDocId)

          if (linkError) {
            console.error("[Booking] Error linking document:", linkError)
          } else {
            console.log("[Booking] Document successfully linked to case")
            sessionStorage.removeItem("active_analysis_doc_id")
            sessionStorage.removeItem("active_analysis_summary")
          }
        }
      }

      // Create appointment request (pending status)
      // Note: If script 016 hasn't been run, we'll fallback to "scheduled"
      const appointmentDataToInsert: any = {
        client_id: clientId,
        lawyer_id: lawyerId,
        case_id: caseData.id,
        scheduled_at: appointmentDateTime.toISOString(),
        duration_minutes: duration,
        status: "pending", // Will try pending first, fallback to scheduled if constraint fails
        notes: `Initial consultation request for ${caseType}`,
      }

      // Add request_message if column exists (from script 016)
      if (caseDescription || caseTitle) {
        appointmentDataToInsert.request_message = caseDescription || `Appointment request for ${caseTitle}`
      }

      const { data: appointmentData, error: appointmentError } = await supabase
        .from("appointments")
        .insert(appointmentDataToInsert)
        .select()
        .single()

      let finalAppointmentData = appointmentData

      if (appointmentError) {
        console.error("[v0] Appointment insert error:", appointmentError)
        console.error("[v0] Appointment error details:", JSON.stringify(appointmentError, null, 2))
        
        // Check if error is due to status constraint (pending not allowed)
        const isStatusConstraintError = 
          appointmentError.message?.includes("appointments_status_check") ||
          appointmentError.message?.includes("check constraint") ||
          appointmentError.code === "23514"

        // Check if error is due to missing request_message column
        const isRequestMessageError = 
          appointmentError.message?.includes("request_message") || 
          appointmentError.code === "42703"

        // Try fixes in order: 1) Remove request_message, 2) Change status to scheduled
        if (isRequestMessageError || isStatusConstraintError) {
          console.log("[v0] Retrying with fixes...")
          
          // Remove request_message if that's the issue
          if (isRequestMessageError) {
            delete appointmentDataToInsert.request_message
          }
          
          // Change status to scheduled if pending is not allowed
          if (isStatusConstraintError) {
            appointmentDataToInsert.status = "scheduled"
            console.log("[v0] Changed status from 'pending' to 'scheduled' (script 016 may not be run)")
          }

          const { data: retryData, error: retryError } = await supabase
            .from("appointments")
            .insert(appointmentDataToInsert)
            .select()
            .single()

          if (retryError) {
            console.error("[v0] Retry also failed:", retryError)
            throw new Error(`Failed to create appointment: ${retryError.message || retryError.code || "Unknown error"}`)
          }
          
          if (!retryData || !retryData.id) {
            throw new Error("Appointment was created but no ID was returned")
          }
          
          finalAppointmentData = retryData
        } else {
          throw new Error(`Failed to create appointment: ${appointmentError.message || appointmentError.code || "Unknown error"}`)
        }
      }

      if (!finalAppointmentData || !finalAppointmentData.id) {
        throw new Error("Appointment was created but no ID was returned")
      }

          if (clientId) {
            await notifyAppointmentRequest(
              supabase,
              {
                lawyerId,
                clientId,
                caseTitle: caseTitle || "Consultation",
                scheduledAt: appointmentDateTime.toISOString(),
                appointmentId: finalAppointmentData.id,
                caseId: caseData.id,
              }
            )
          }

          setBookedAppointmentId(finalAppointmentData.id)
      setStep("success")

      toast({
        title: "Request Sent!",
        description: `Your appointment request has been sent to ${lawyerName}. They will review and respond soon.`,
      })

      setTimeout(() => {
        onOpenChange(false)
        onBookingSuccess?.()
        // Reset form
        setStep("select-date")
        setSelectedDate(null)
        setSelectedTime("")
        setCaseType("")
        setCaseTitle("")
        setCaseDescription("")
      }, 3000)
    } catch (error: any) {
      console.error("[v0] Booking error:", error)
      console.error("[v0] Error details:", JSON.stringify(error, null, 2))
      
      let errorMessage = "Failed to send appointment request. Please try again."
      if (error?.message) {
        errorMessage = error.message
      } else if (error?.code) {
        errorMessage = `Database error: ${error.code}. ${error.message || error.hint || ""}`
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const calculateCost = () => {
    const rate = Number(hourlyRate) || 0
    if (rate <= 0) {
      console.warn("[v0] Invalid hourly rate:", hourlyRate)
      return 0
    }
    const cost = (duration / 60) * rate
    console.log("[v0] Cost calculation:", { hourlyRate: rate, duration, cost })
    return cost
  }

  // Check if date is disabled (past or fully booked)
  const isDateDisabled = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0]
    return isPast(startOfDay(date)) || bookedDates.includes(dateStr)
  }

  // Get date modifiers for calendar
  const dateModifiers = {
    booked: (date: Date) => {
      const dateStr = date.toISOString().split("T")[0]
      return bookedDates.includes(dateStr)
    },
    past: (date: Date) => isPast(startOfDay(date)),
  }

  const dateModifiersClassNames = {
    booked: "bg-red-100 text-red-700 cursor-not-allowed opacity-50",
    past: "bg-muted text-muted-foreground cursor-not-allowed opacity-50",
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request Appointment</DialogTitle>
          <DialogDescription>Send a booking request to {lawyerName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Step Indicator */}
          <div className="flex gap-2 text-xs">
            <div className={`flex-1 h-1 rounded-full ${step !== "select-date" ? "bg-primary" : "bg-primary/30"}`} />
            <div
              className={`flex-1 h-1 rounded-full ${["case-details", "confirm", "success"].includes(step) ? "bg-primary" : "bg-primary/30"}`}
            />
            <div
              className={`flex-1 h-1 rounded-full ${["confirm", "success"].includes(step) ? "bg-primary" : "bg-primary/30"}`}
            />
          </div>

          {/* Step: Select Date & Time */}
          {step === "select-date" && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Select Date</label>
                <div className="border rounded-lg p-4 bg-card">
                  <DayPicker
                    mode="single"
                    selected={selectedDate || undefined}
                    onSelect={(date) => {
                      if (date && !isDateDisabled(date)) {
                        setSelectedDate(date)
                        setSelectedTime("")
                      }
                    }}
                    disabled={isDateDisabled}
                    modifiers={dateModifiers}
                    modifiersClassNames={dateModifiersClassNames}
                    fromDate={new Date()}
                    className="w-full"
                    classNames={{
                      months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                      month: "space-y-4",
                      caption: "flex justify-center pt-1 relative items-center",
                      caption_label: "text-sm font-medium",
                      nav: "space-x-1 flex items-center",
                      nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
                      nav_button_previous: "absolute left-1",
                      nav_button_next: "absolute right-1",
                      table: "w-full border-collapse space-y-1",
                      head_row: "flex",
                      head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
                      row: "flex w-full mt-2",
                      cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                      day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100",
                      day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                      day_today: "bg-accent text-accent-foreground",
                      day_outside: "text-muted-foreground opacity-50",
                      day_disabled: "text-muted-foreground opacity-50",
                      day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                      day_hidden: "invisible",
                    }}
                  />
                </div>
                {selectedDate && bookedDates.includes(selectedDate.toISOString().split("T")[0]) && (
                  <p className="text-xs text-muted-foreground mt-2">
                    This date has limited availability. Please select a time slot below.
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Duration</label>
                <div className="flex gap-2">
                  {[30, 60, 90].map((d) => (
                    <button
                      key={d}
                      onClick={() => {
                        setDuration(d as 30 | 60 | 90)
                        setSelectedTime("") // Reset time when duration changes
                      }}
                      className={`flex-1 rounded-md border py-2 text-sm font-medium transition ${
                        duration === d
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-input bg-background text-foreground hover:border-primary/50"
                      }`}
                    >
                      {d}m
                    </button>
                  ))}
                </div>
              </div>

              {selectedDate && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Select Time</label>
                  {isLoadingSlots ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : availableSlots.length > 0 ? (
                    <div className="grid grid-cols-4 gap-2">
                      {availableSlots.map((slot) => (
                        <button
                          key={slot}
                          onClick={() => setSelectedTime(slot)}
                          className={`rounded-md border py-2 text-xs font-medium transition ${
                            selectedTime === slot
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-input bg-background text-foreground hover:border-primary/50"
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex gap-2 rounded-md bg-yellow-50 dark:bg-yellow-900/20 p-3 text-sm text-yellow-900 dark:text-yellow-200">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      <p>No available slots for this date. Please select another date.</p>
                    </div>
                  )}
                </div>
              )}

              <Button
                onClick={() => setStep("case-details")}
                disabled={!selectedDate || !selectedTime || isLoadingSlots}
                className="w-full"
              >
                Continue
              </Button>
            </div>
          )}

          {/* Step: Case Details */}
          {step === "case-details" && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Case Type*</label>
                <Select value={caseType} onValueChange={setCaseType}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select case type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Family">Family Law</SelectItem>
                    <SelectItem value="Corporate">Corporate Law</SelectItem>
                    <SelectItem value="Criminal">Criminal Defense</SelectItem>
                    <SelectItem value="Civil">Civil Litigation</SelectItem>
                    <SelectItem value="Intellectual">Intellectual Property</SelectItem>
                    <SelectItem value="Real Estate">Real Estate</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Case Title*</label>
                <input
                  type="text"
                  value={caseTitle}
                  onChange={(e) => setCaseTitle(e.target.value)}
                  placeholder="Brief title of the case"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Description</label>
                <textarea
                  value={caseDescription}
                  onChange={(e) => setCaseDescription(e.target.value)}
                  placeholder="Describe your legal issue..."
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-2 rounded-md bg-muted p-3">
                <p className="text-xs font-medium text-muted-foreground">Appointment Summary</p>
                <p className="text-sm font-medium">
                  {selectedDate ? format(selectedDate, "PPP") : "No date selected"} at {selectedTime || "No time selected"}
                </p>
                <p className="text-sm text-muted-foreground">{duration} minutes</p>
                <p className="text-sm font-medium">
                  Est. Cost: ${calculateCost().toFixed(2)}
                  {hourlyRate > 0 ? ` (${hourlyRate.toFixed(2)}/hr × ${(duration / 60).toFixed(1)}hr)` : ""}
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("select-date")} className="flex-1">
                  Back
                </Button>
                <Button onClick={() => setStep("confirm")} disabled={!caseType || !caseTitle} className="flex-1">
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* Step: Confirm */}
          {step === "confirm" && (
            <div className="space-y-4">
              <div className="space-y-3 rounded-md bg-muted p-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Date & Time</p>
                    <p className="text-sm font-medium">
                      {selectedDate ? format(selectedDate, "PPP") : "No date"} at {selectedTime}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Duration</p>
                    <p className="text-sm font-medium">{duration} minutes</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Case</p>
                    <p className="text-sm font-medium">{caseTitle}</p>
                  </div>
                </div>
                <div className="border-t border-border pt-3">
                  <p className="text-xs text-muted-foreground">Estimated Cost</p>
                  <p className="text-lg font-bold text-primary">${calculateCost().toFixed(2)}</p>
                </div>
              </div>

              <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md">
                <p className="font-medium mb-1">Note:</p>
                <p>
                  This is a booking request. The lawyer will review your request and respond within 24 hours. You'll be notified once they accept or decline.
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("case-details")} className="flex-1">
                  Back
                </Button>
                <Button onClick={handleRequestAppointment} disabled={isLoading} className="flex-1">
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send Request
                </Button>
              </div>
            </div>
          )}

          {/* Step: Success */}
          {step === "success" && (
            <div className="space-y-4 py-4 text-center">
              <div className="flex justify-center">
                <CheckCircle className="h-12 w-12 text-green-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Request Sent!</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Your appointment request has been sent to {lawyerName}. They will review and respond soon. You'll receive a notification once they accept or decline.
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
