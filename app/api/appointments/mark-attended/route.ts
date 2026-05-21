import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { appendCaseTimelineEvent, CaseTimelineEventType } from "@/lib/case-timeline"

/**
 * Marks a consultation as held (`attended`).
 * proceed_with_case=true (default): case open → in_progress.
 * proceed_with_case=false: case → closed (no review flow).
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
    const proceedWithCase = body?.proceed_with_case !== false

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

    if (row.client_id !== user.id) {
      return NextResponse.json(
        { error: "Only the client can confirm whether the consultation was held and if the case continues" },
        { status: 403 },
      )
    }

    if (row.status !== "scheduled" && row.status !== "rescheduled") {
      return NextResponse.json({ error: `Cannot mark attended from status: ${row.status}` }, { status: 400 })
    }

    const start = new Date(row.scheduled_at).getTime()
    const now = Date.now()
    const allowEarlyMs = 7 * 24 * 60 * 60_000
    if (now < start - allowEarlyMs) {
      return NextResponse.json(
        { error: "Consultation slot is too far in the future to mark as held (7-day window)" },
        { status: 400 },
      )
    }

    const { error: updErr } = await supabase
      .from("appointments")
      .update({ status: "attended", updated_at: new Date().toISOString() })
      .eq("id", appointmentId)
      .in("status", ["scheduled", "rescheduled"])

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 400 })
    }

    let caseStatus: string | null = null

    if (row.case_id) {
      if (proceedWithCase) {
        const { data: activatedCase, error: caseUpdateError } = await supabase
          .from("cases")
          .update({ status: "in_progress", updated_at: new Date().toISOString() })
          .eq("id", row.case_id)
          .eq("status", "open")
          .select("id")
          .maybeSingle()

        if (caseUpdateError) {
          return NextResponse.json({ error: caseUpdateError.message }, { status: 400 })
        }

        caseStatus = activatedCase ? "in_progress" : "in_progress"

        await appendCaseTimelineEvent(supabase, {
          caseId: row.case_id,
          actorId: user.id,
          eventType: CaseTimelineEventType.CONSULTATION_ATTENDED,
          metadata: { appointment_id: appointmentId, proceed_with_case: true },
        })

        if (activatedCase) {
          await appendCaseTimelineEvent(supabase, {
            caseId: row.case_id,
            actorId: user.id,
            eventType: CaseTimelineEventType.CASE_ACTIVATED,
            metadata: { appointment_id: appointmentId, source: "mark_attended" },
          })
        }
      } else {
        const { error: closeErr } = await supabase
          .from("cases")
          .update({ status: "closed", updated_at: new Date().toISOString() })
          .eq("id", row.case_id)
          .in("status", ["open", "in_progress", "pending_completion"])

        if (closeErr) {
          return NextResponse.json({ error: closeErr.message }, { status: 400 })
        }

        caseStatus = "closed"

        await appendCaseTimelineEvent(supabase, {
          caseId: row.case_id,
          actorId: user.id,
          eventType: CaseTimelineEventType.CONSULTATION_ATTENDED,
          metadata: { appointment_id: appointmentId, proceed_with_case: false, case_closed: true },
        })
      }
    }

    return NextResponse.json({
      success: true,
      status: "attended",
      case_status: caseStatus,
      proceed_with_case: proceedWithCase,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
