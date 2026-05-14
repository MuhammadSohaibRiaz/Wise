import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { appendCaseTimelineEvent, CaseTimelineEventType } from "@/lib/case-timeline"
import { notifyAppointmentUpdate } from "@/lib/notifications"

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
    const reason = (body?.reason as string | undefined) || ""

    if (!appointmentId) {
      return NextResponse.json({ error: "appointment_id is required" }, { status: 400 })
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

    if (row.status !== "pending" && row.status !== "awaiting_payment") {
      return NextResponse.json(
        { error: "This appointment cannot be cancelled. If you need to cancel a paid appointment, please contact support." },
        { status: 400 },
      )
    }

    const { error: updErr } = await supabase
      .from("appointments")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", appointmentId)
      .in("status", ["pending", "awaiting_payment"])

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 400 })
    }

    // --- Side effects ---
    const isClient = user.id === row.client_id
    const recipientId = isClient ? row.lawyer_id : row.client_id
    const template = isClient ? "client_cancel" : "lawyer_cancel"

    const { data: actorProfile } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .single()

    const actorName = actorProfile
      ? `${actorProfile.first_name || ""} ${actorProfile.last_name || ""}`.trim()
      : "The other party"

    let caseTitle = ""
    if (row.case_id) {
      const { data: caseData } = await supabase
        .from("cases")
        .select("title")
        .eq("id", row.case_id)
        .single()
      caseTitle = caseData?.title || ""
    }

    await notifyAppointmentUpdate(supabase, template, {
      recipientId,
      actorId: user.id,
      caseTitle,
      scheduledAt: row.scheduled_at,
      appointmentId,
      caseId: row.case_id,
    })

    if (row.case_id) {
      await appendCaseTimelineEvent(supabase, {
        caseId: row.case_id,
        actorId: user.id,
        eventType: CaseTimelineEventType.APPOINTMENT_CANCELLED,
        metadata: {
          appointment_id: appointmentId,
          cancelled_by: user.id,
          reason: reason || undefined,
        },
      })
    }

    const recipientRole = isClient ? "lawyer" : "client"
    fetch(new URL("/api/notify/email", req.url).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cron-secret": process.env.CRON_SECRET || "" },
      body: JSON.stringify({
        template: "appointment_cancelled",
        data: {
          recipient_id: recipientId,
          actor_name: actorName,
          case_title: caseTitle,
          recipient_role: recipientRole,
        },
      }),
    }).catch(() => {})

    return NextResponse.json({ success: true, status: "cancelled" })
  } catch (e: any) {
    console.error("[Cancel API] Error:", e)
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 })
  }
}
