import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { appendCaseTimelineEvent, CaseTimelineEventType } from "@/lib/case-timeline"
import { getAppointmentSlotEnd } from "@/lib/appointments/slot-availability"

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
    if (!appointmentId) {
      return NextResponse.json({ error: "appointment_id required" }, { status: 400 })
    }

    const { data: row, error: fetchErr } = await supabase
      .from("appointments")
      .select("id, client_id, lawyer_id, status, scheduled_at, duration_minutes, case_id")
      .eq("id", appointmentId)
      .maybeSingle()

    if (fetchErr || !row) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
    }

    if (row.client_id !== user.id && row.lawyer_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (row.status !== "scheduled" && row.status !== "rescheduled") {
      return NextResponse.json(
        { error: `Cannot mark no-show from status: ${row.status}` },
        { status: 400 },
      )
    }

    const slotEnd = getAppointmentSlotEnd(row.scheduled_at, row.duration_minutes || 60)
    if (Date.now() < slotEnd.getTime()) {
      return NextResponse.json(
        { error: "No-show can only be recorded after the scheduled consultation time has passed." },
        { status: 400 },
      )
    }

    const admin = createAdminClient()

    const { error: updErr } = await admin
      .from("appointments")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", appointmentId)
      .in("status", ["scheduled", "rescheduled"])

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 400 })
    }

    if (row.case_id) {
      const { error: caseErr } = await admin
        .from("cases")
        .update({ status: "closed", updated_at: new Date().toISOString() })
        .eq("id", row.case_id)
        .in("status", ["open", "in_progress", "pending_completion"])

      if (caseErr) {
        console.warn("[mark-no-show] case close:", caseErr.message)
      }

      await appendCaseTimelineEvent(admin, {
        caseId: row.case_id,
        actorId: user.id,
        eventType: CaseTimelineEventType.CONSULTATION_NO_SHOW,
        metadata: { appointment_id: appointmentId, source: "mark_no_show" },
      })
    }
    const { data: adminProfiles } = await admin
      .from("profiles")
      .select("id")
      .eq("user_type", "admin")

    if (adminProfiles?.length) {
      await admin.from("notifications").insert(
        adminProfiles.map((p) => ({
          user_id: p.id,
          created_by: user.id,
          type: "appointment_update",
          title: "Consultation marked as no-show",
          description: "An appointment was closed as no-show and the linked case was closed.",
          data: { appointment_id: appointmentId, case_id: row.case_id, action: "no_show" },
        })),
      )
    }

    return NextResponse.json({ success: true, status: "cancelled", case_status: "closed" })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
