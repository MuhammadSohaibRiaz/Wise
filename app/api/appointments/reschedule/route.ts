import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { appendCaseTimelineEvent, CaseTimelineEventType } from "@/lib/case-timeline"
import { notifyAppointmentUpdate } from "@/lib/notifications"
import { APPOINTMENT_SLOT_BLOCKING_STATUSES } from "@/lib/appointments-status"

const TWO_HOURS_MS = 2 * 60 * 60 * 1000
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000
const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000
const SLOT_BUFFER_MINUTES = 60

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const appointmentId = body?.appointment_id as string | undefined
    const newScheduledAt = body?.new_scheduled_at as string | undefined

    if (!appointmentId || !newScheduledAt) {
      return NextResponse.json({ error: "appointment_id and new_scheduled_at are required" }, { status: 400 })
    }

    const newTime = new Date(newScheduledAt)
    if (Number.isNaN(newTime.getTime())) {
      return NextResponse.json({ error: "Invalid date format for new_scheduled_at" }, { status: 400 })
    }

    const { data: row, error: fetchErr } = await supabase
      .from("appointments")
      .select("id, client_id, lawyer_id, status, scheduled_at, duration_minutes, case_id, reschedule_count")
      .eq("id", appointmentId)
      .maybeSingle()

    if (fetchErr || !row) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
    }

    if (row.client_id !== user.id && row.lawyer_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // --- Business Rule 1: Status check ---
    if (row.status !== "scheduled" && row.status !== "rescheduled") {
      return NextResponse.json(
        { error: "Appointment cannot be rescheduled in its current status" },
        { status: 400 },
      )
    }

    // --- Business Rule 2: Cannot reschedule within 2 hours of appointment ---
    const now = Date.now()
    const appointmentStart = new Date(row.scheduled_at).getTime()
    if (appointmentStart - now < TWO_HOURS_MS) {
      return NextResponse.json(
        { error: "Cannot reschedule within 2 hours of the appointment" },
        { status: 400 },
      )
    }

    // --- Business Rule 3: New time must be at least 24 hours from now ---
    if (newTime.getTime() - now < TWENTY_FOUR_HOURS_MS) {
      return NextResponse.json(
        { error: "New time must be at least 24 hours from now" },
        { status: 400 },
      )
    }

    // --- Business Rule 4: New time must be within 60 days ---
    if (newTime.getTime() - now > SIXTY_DAYS_MS) {
      return NextResponse.json(
        { error: "New time must be within 60 days" },
        { status: 400 },
      )
    }

    // --- Business Rule 5: Maximum 3 reschedules ---
    if (row.reschedule_count >= 3) {
      return NextResponse.json(
        { error: "Maximum reschedules (3) reached for this appointment" },
        { status: 400 },
      )
    }

    const dayStart = new Date(newTime)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(newTime)
    dayEnd.setHours(23, 59, 59, 999)

    const { data: existingAppointments, error: conflictErr } = await supabase
      .from("appointments")
      .select("id, scheduled_at, duration_minutes")
      .eq("lawyer_id", row.lawyer_id)
      .in("status", [...APPOINTMENT_SLOT_BLOCKING_STATUSES])
      .neq("id", appointmentId)
      .gte("scheduled_at", dayStart.toISOString())
      .lte("scheduled_at", dayEnd.toISOString())

    if (conflictErr) {
      return NextResponse.json({ error: "Failed to check for conflicts" }, { status: 500 })
    }

    const slotStart = newTime.getTime()
    const actualDuration = Math.max(row.duration_minutes || SLOT_BUFFER_MINUTES, SLOT_BUFFER_MINUTES)
    const slotEnd = slotStart + actualDuration * 60 * 1000
    const hasConflict = (existingAppointments || []).some((apt) => {
      const aptStart = new Date(apt.scheduled_at).getTime()
      const aptEnd = aptStart + Math.max(apt.duration_minutes || SLOT_BUFFER_MINUTES, SLOT_BUFFER_MINUTES) * 60 * 1000
      return !(slotEnd <= aptStart || slotStart >= aptEnd)
    })

    if (hasConflict) {
      return NextResponse.json(
        { error: "Time slot conflicts with another appointment" },
        { status: 409 },
      )
    }

    // --- Perform the update ---
    const { error: updErr } = await supabase
      .from("appointments")
      .update({
        scheduled_at: newTime.toISOString(),
        status: "rescheduled",
        reschedule_count: row.reschedule_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", appointmentId)
      .in("status", ["scheduled", "rescheduled"])

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 400 })
    }

    // --- Side effects (fire and forget) ---
    const isClient = user.id === row.client_id
    const recipientId = isClient ? row.lawyer_id : row.client_id
    const template = isClient ? "client_reschedule" : "lawyer_reschedule"

    // Fetch actor name for notifications/email
    const { data: actorProfile } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .single()

    const actorName = actorProfile
      ? `${actorProfile.first_name || ""} ${actorProfile.last_name || ""}`.trim()
      : "The other party"

    // Fetch case title
    let caseTitle = ""
    if (row.case_id) {
      const { data: caseData } = await supabase
        .from("cases")
        .select("title")
        .eq("id", row.case_id)
        .single()
      caseTitle = caseData?.title || ""
    }

    // In-app notification
    await notifyAppointmentUpdate(supabase, template, {
      recipientId,
      actorId: user.id,
      caseTitle,
      scheduledAt: newTime.toISOString(),
      appointmentId,
      caseId: row.case_id,
    })

    // Timeline event
    if (row.case_id) {
      await appendCaseTimelineEvent(supabase, {
        caseId: row.case_id,
        actorId: user.id,
        eventType: CaseTimelineEventType.CONSULTATION_RESCHEDULED,
        metadata: {
          appointment_id: appointmentId,
          old_time: row.scheduled_at,
          new_time: newTime.toISOString(),
          rescheduled_by: user.id,
          reschedule_count: row.reschedule_count + 1,
        },
      })
    }

    // Email notification (fire and forget)
    const recipientRole = isClient ? "lawyer" : "client"
    fetch(new URL("/api/notify/email", req.url).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cron-secret": process.env.CRON_SECRET || "" },
      body: JSON.stringify({
        template: "appointment_rescheduled",
        data: {
          recipient_id: recipientId,
          actor_name: actorName,
          case_title: caseTitle,
          new_time: newTime.toISOString(),
          recipient_role: recipientRole,
        },
      }),
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      status: "rescheduled",
      scheduled_at: newTime.toISOString(),
      reschedule_count: row.reschedule_count + 1,
    })
  } catch (e: any) {
    console.error("[Reschedule API] Error:", e)
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 })
  }
}
