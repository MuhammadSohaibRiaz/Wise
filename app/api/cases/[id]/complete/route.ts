import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { appendCaseTimelineEvent, CaseTimelineEventType } from "@/lib/case-timeline"
import { createNotification } from "@/lib/notifications"
import { recomputeLawyerSuccessRate } from "@/lib/recompute-lawyer-success-rate"

const VALID_OUTCOMES = ["won", "lost", "settled", "ongoing"] as const

type RouteContext = { params: { id: string } }

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const caseId = context.params.id
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const caseOutcome = body?.case_outcome as string | undefined

    if (!caseOutcome || !VALID_OUTCOMES.includes(caseOutcome as (typeof VALID_OUTCOMES)[number])) {
      return NextResponse.json(
        { error: "case_outcome must be one of: won, lost, settled, ongoing" },
        { status: 400 },
      )
    }

    const { data: caseRow, error: caseErr } = await supabase
      .from("cases")
      .select("id, title, status, client_id, lawyer_id")
      .eq("id", caseId)
      .maybeSingle()

    if (caseErr || !caseRow) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 })
    }

    if (caseRow.client_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (caseRow.status !== "pending_completion") {
      return NextResponse.json(
        { error: "Completion can only be confirmed when the case is pending completion." },
        { status: 400 },
      )
    }

    const { data: updatedCase, error: updateErr } = await supabase
      .from("cases")
      .update({
        status: "completed",
        case_outcome: caseOutcome,
        updated_at: new Date().toISOString(),
      })
      .eq("id", caseId)
      .eq("status", "pending_completion")
      .select("id, title, status, case_outcome, lawyer_id")
      .maybeSingle()

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 400 })
    }

    if (!updatedCase) {
      return NextResponse.json({ error: "Completion request is no longer pending." }, { status: 409 })
    }

    await appendCaseTimelineEvent(supabase, {
      caseId,
      actorId: user.id,
      eventType: CaseTimelineEventType.CASE_COMPLETED,
      metadata: {
        previous_status: "pending_completion",
        source: "client_confirm_completion",
        case_outcome: caseOutcome,
      },
    })

    if (updatedCase.lawyer_id) {
      const admin = createAdminClient()
      await recomputeLawyerSuccessRate(admin, updatedCase.lawyer_id)

      await createNotification(supabase, {
        user_id: updatedCase.lawyer_id,
        type: "case_update",
        title: "Case Completed",
        description: `Client confirmed completion for "${updatedCase.title || "your case"}".`,
        data: { case_id: caseId, status: "completed", case_outcome: caseOutcome },
      })
    }

    return NextResponse.json({
      success: true,
      case: updatedCase,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
