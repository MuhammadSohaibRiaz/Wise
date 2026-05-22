import { NextRequest, NextResponse } from "next/server"

import { appendCaseTimelineEvent, CaseTimelineEventType } from "@/lib/case-timeline"
import { APPOINTMENT_SLOT_BLOCKING_STATUSES } from "@/lib/appointments-status"
import { notifyAppointmentUpdate } from "@/lib/notifications"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

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
    const action = body?.action as "accept" | "reject" | undefined

    if (!appointmentId || (action !== "accept" && action !== "reject")) {
      return NextResponse.json({ error: "appointment_id and action are required" }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: row, error: fetchError } = await admin
      .from("appointments")
      .select(`
        id,
        client_id,
        lawyer_id,
        status,
        scheduled_at,
        duration_minutes,
        case_id,
        cases (
          id,
          title
        )
      `)
      .eq("id", appointmentId)
      .maybeSingle()

    if (fetchError || !row) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
    }

    if (row.lawyer_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (row.status !== "pending") {
      return NextResponse.json({ error: "Only pending appointment requests can be accepted or rejected" }, { status: 400 })
    }

    const caseId = row.case_id as string | null
    const caseTitle =
      (row.cases as any)?.title ||
      (Array.isArray(row.cases) ? (row.cases[0] as any)?.title : null) ||
      "Consultation"

    if (action === "accept") {
      // Acceptance does not schedule work directly. It moves the request to
      // awaiting_payment so Stripe payment remains mandatory before the slot is
      // treated as confirmed.
      const { data: blockedAppointments, error: scheduleError } = await admin
        .from("appointments")
        .select("id, scheduled_at, duration_minutes")
        .eq("lawyer_id", user.id)
        .in("status", [...APPOINTMENT_SLOT_BLOCKING_STATUSES])
        .neq("id", appointmentId)

      if (scheduleError) {
        return NextResponse.json({ error: "Failed to check lawyer schedule" }, { status: 500 })
      }

      const slotStart = new Date(row.scheduled_at).getTime()
      const duration = Math.max(row.duration_minutes || SLOT_BUFFER_MINUTES, SLOT_BUFFER_MINUTES)
      const slotEnd = slotStart + duration * 60 * 1000
      const hasConflict = (blockedAppointments || []).some((apt) => {
        const aptStart = new Date(apt.scheduled_at).getTime()
        const aptDuration = Math.max(apt.duration_minutes || SLOT_BUFFER_MINUTES, SLOT_BUFFER_MINUTES)
        const aptEnd = aptStart + aptDuration * 60 * 1000
        return !(slotEnd <= aptStart || slotStart >= aptEnd)
      })

      if (hasConflict) {
        return NextResponse.json({ error: "Time slot conflicts with another appointment" }, { status: 409 })
      }

      const { error: appointmentError } = await admin
        .from("appointments")
        .update({ status: "awaiting_payment", responded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", appointmentId)
        .eq("status", "pending")

      if (appointmentError) {
        return NextResponse.json({ error: appointmentError.message }, { status: 400 })
      }

      if (caseId) {
        await admin
          .from("cases")
          .update({ status: "open", lawyer_id: user.id, updated_at: new Date().toISOString() })
          .eq("id", caseId)
          .eq("status", "open")
      }

      await notifyAppointmentUpdate(admin, "lawyer_accept", {
        recipientId: row.client_id,
        actorId: user.id,
        caseTitle,
        scheduledAt: row.scheduled_at,
        appointmentId,
        caseId: caseId || undefined,
      })

      if (caseId) {
        await appendCaseTimelineEvent(admin, {
          caseId,
          actorId: user.id,
          eventType: CaseTimelineEventType.CONSULTATION_ACCEPTED,
          metadata: {
            appointment_id: appointmentId,
            previous_status: "pending",
            status_after: "awaiting_payment",
            action: "lawyer_accepted",
            source: "appointments_respond_api",
          },
        })
      }

      fetch(new URL("/api/notify/email", req.url).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-cron-secret": process.env.CRON_SECRET || "" },
        body: JSON.stringify({
          template: "appointment_accepted",
          data: { client_id: row.client_id, lawyer_id: user.id, case_title: caseTitle, case_id: caseId },
        }),
      }).catch(() => {})

      return NextResponse.json({ success: true, status: "awaiting_payment" })
    }

    // Rejection closes the provisional open case because no lawyer-client
    // engagement was formed.
    const { error: appointmentError } = await admin
      .from("appointments")
      .update({ status: "rejected", responded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", appointmentId)
      .eq("status", "pending")

    if (appointmentError) {
      return NextResponse.json({ error: appointmentError.message }, { status: 400 })
    }

    if (caseId) {
      await admin
        .from("cases")
        .update({ lawyer_id: null, status: "closed", updated_at: new Date().toISOString() })
        .eq("id", caseId)
        .eq("status", "open")
    }

    await notifyAppointmentUpdate(admin, "lawyer_reject", {
      recipientId: row.client_id,
      actorId: user.id,
      caseTitle,
      appointmentId,
      caseId: caseId || undefined,
    })

    fetch(new URL("/api/notify/email", req.url).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cron-secret": process.env.CRON_SECRET || "" },
      body: JSON.stringify({
        template: "appointment_rejected",
        data: { client_id: row.client_id, lawyer_id: user.id, case_title: caseTitle, case_id: caseId },
      }),
    }).catch(() => {})

    if (caseId) {
      await appendCaseTimelineEvent(admin, {
        caseId,
        actorId: user.id,
        eventType: CaseTimelineEventType.LAWYER_REJECTED_CONSULTATION,
        metadata: {
          appointment_id: appointmentId,
          previous_status: "pending",
          status_after: "rejected",
          action: "lawyer_rejected",
          source: "appointments_respond_api",
        },
      })
    }

    return NextResponse.json({ success: true, status: "rejected" })
  } catch (error: any) {
    console.error("[Appointment Respond API] Error:", error)
    return NextResponse.json({ error: error?.message || "Server error" }, { status: 500 })
  }
}
