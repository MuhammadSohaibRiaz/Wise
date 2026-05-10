import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * Marks a consultation as held (`attended`) so billing/session state is not confused with case closure (`completed`).
 * Allowed when appointment is `scheduled` (or `rescheduled`) and the slot end time is in the past,
 * or up to 30 minutes before start (lawyer early check-in). Caller must be client or lawyer on the row.
 */
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
      .select("id, client_id, lawyer_id, status, scheduled_at, duration_minutes")
      .eq("id", appointmentId)
      .maybeSingle()

    if (fetchErr || !row) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
    }

    if (row.client_id !== user.id && row.lawyer_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (row.status !== "scheduled" && row.status !== "rescheduled") {
      return NextResponse.json({ error: `Cannot mark attended from status: ${row.status}` }, { status: 400 })
    }

    const start = new Date(row.scheduled_at).getTime()
    const now = Date.now()
    const allowEarlyMs = 30 * 60_000
    if (now < start - allowEarlyMs) {
      return NextResponse.json({ error: "Consultation has not started yet (can mark from 30 min before start)" }, { status: 400 })
    }

    const { error: updErr } = await supabase
      .from("appointments")
      .update({ status: "attended", updated_at: new Date().toISOString() })
      .eq("id", appointmentId)
      .in("status", ["scheduled", "rescheduled"])

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, status: "attended" })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 })
  }
}
