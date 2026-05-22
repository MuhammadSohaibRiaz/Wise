"use client"

import { Button } from "@/components/ui/button"
import { CalendarClock, Loader2, UserX } from "lucide-react"
import {
  formatRescheduleButtonLabel,
  MAX_RESCHEDULES_MESSAGE,
} from "@/lib/appointments/reschedule-label"
import { canMarkConsultationHeld, canMarkNoShow } from "@/lib/appointments/slot-availability"

type ConsultationAppointment = {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  reschedule_count: number
}

type ScheduledConsultationActionsProps = {
  appointment: ConsultationAppointment
  processingId: string | null
  canReschedule: boolean
  /** Client-only: confirm consultation held and proceed or close case */
  allowMarkHeld?: boolean
  onMarkHeld?: () => void
  onReschedule: () => void
  onSupport: () => void
  onNoShow: () => void
}

export function ScheduledConsultationActions({
  appointment,
  processingId,
  canReschedule,
  allowMarkHeld = false,
  onMarkHeld,
  onReschedule,
  onSupport,
  onNoShow,
}: ScheduledConsultationActionsProps) {
  const markHeldEnabled = canMarkConsultationHeld(
    appointment.status,
    appointment.scheduled_at,
    appointment.duration_minutes,
    appointment.reschedule_count,
  )
  const noShowEnabled = canMarkNoShow(
    appointment.status,
    appointment.scheduled_at,
    appointment.duration_minutes,
  )
  const rescheduleLabel = formatRescheduleButtonLabel(appointment.reschedule_count)
  const isProcessing = processingId === appointment.id

  return (
    <div className="flex flex-col items-end gap-2">
      {allowMarkHeld && onMarkHeld ? (
        <Button
          size="sm"
          variant="outline"
          disabled={isProcessing || !markHeldEnabled}
          onClick={onMarkHeld}
          title={!markHeldEnabled ? "Available within 7 days of the consultation" : undefined}
        >
          {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mark Consultation Held"}
        </Button>
      ) : null}
      {canReschedule && rescheduleLabel ? (
        <Button size="sm" variant="outline" onClick={onReschedule}>
          <CalendarClock className="h-4 w-4 mr-1" />
          {rescheduleLabel}
        </Button>
      ) : appointment.reschedule_count >= 3 ? (
        <p className="text-xs text-muted-foreground text-right max-w-[220px]">
          {MAX_RESCHEDULES_MESSAGE}
        </p>
      ) : null}
      {noShowEnabled && (
        <Button
          size="sm"
          variant="outline"
          className="text-destructive border-destructive/50 hover:bg-destructive/10"
          disabled={isProcessing}
          onClick={onNoShow}
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <UserX className="h-4 w-4 mr-1" />
              Report No-Show
            </>
          )}
        </Button>
      )}
      <button
        type="button"
        className="text-xs text-muted-foreground hover:text-primary underline"
        onClick={onSupport}
      >
        Need to cancel? Contact Support
      </button>
    </div>
  )
}
