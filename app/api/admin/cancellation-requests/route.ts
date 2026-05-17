import { NextRequest, NextResponse } from "next/server"

import { appendCaseTimelineEvent, CaseTimelineEventType } from "@/lib/case-timeline"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

type Resolution = "approved" | "rejected"

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("user_type")
    .eq("id", user.id)
    .maybeSingle()

  if (error || profile?.user_type !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { user }
}

function mapRequest(apt: any) {
  return {
    id: apt.id,
    scheduled_at: apt.scheduled_at,
    duration_minutes: apt.duration_minutes,
    reschedule_count: apt.reschedule_count || 0,
    previous_status: apt.previous_status || null,
    case_id: apt.cases?.id || apt.case_id || "",
    case_title: apt.cases?.title || "Unknown",
    case_type: apt.cases?.case_type || "",
    client: apt.client || { id: "", first_name: "Unknown", last_name: "", email: "" },
    lawyer: apt.lawyer || { id: "", first_name: "Unknown", last_name: "", email: "" },
  }
}

async function sendResolutionEmails(req: NextRequest, request: any, resolution: Resolution, reason?: string) {
  const origin = req.nextUrl.origin
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (process.env.CRON_SECRET) headers["x-cron-secret"] = process.env.CRON_SECRET

  await Promise.allSettled([
    fetch(`${origin}/api/notify/email`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        template: "appointment_cancellation_resolved",
        data: {
          recipient_id: request.client.id,
          case_title: request.case_title,
          resolution,
          reason: reason || undefined,
          recipient_role: "client",
        },
      }),
    }),
    fetch(`${origin}/api/notify/email`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        template: "appointment_cancellation_resolved",
        data: {
          recipient_id: request.lawyer.id,
          case_title: request.case_title,
          resolution,
          reason: reason || undefined,
          recipient_role: "lawyer",
        },
      }),
    }),
  ])
}

export async function GET() {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("appointments")
    .select(`
      id,
      scheduled_at,
      duration_minutes,
      reschedule_count,
      previous_status,
      case_id,
      cases (
        id,
        title,
        case_type
      ),
      client:profiles!appointments_client_id_fkey (
        id,
        first_name,
        last_name,
        email
      ),
      lawyer:profiles!appointments_lawyer_id_fkey (
        id,
        first_name,
        last_name,
        email
      )
    `)
    .eq("status", "cancellation_requested")
    .order("updated_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ requests: (data || []).map(mapRequest) })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const body = await req.json().catch(() => ({}))
  const requestId = body?.request_id as string | undefined
  const action = body?.action as Resolution | undefined
  const reason = (body?.reason as string | undefined)?.trim() || ""

  if (!requestId || (action !== "approved" && action !== "rejected")) {
    return NextResponse.json({ error: "request_id and action are required" }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: row, error: fetchError } = await admin
    .from("appointments")
    .select(`
      id,
      scheduled_at,
      duration_minutes,
      reschedule_count,
      previous_status,
      case_id,
      status,
      cases (
        id,
        title,
        case_type
      ),
      client:profiles!appointments_client_id_fkey (
        id,
        first_name,
        last_name,
        email
      ),
      lawyer:profiles!appointments_lawyer_id_fkey (
        id,
        first_name,
        last_name,
        email
      )
    `)
    .eq("id", requestId)
    .maybeSingle()

  if (fetchError || !row) {
    return NextResponse.json({ error: "Cancellation request not found" }, { status: 404 })
  }

  if (row.status !== "cancellation_requested") {
    return NextResponse.json({ error: "This request has already been resolved" }, { status: 409 })
  }

  const requestData = mapRequest(row)
  const restoredStatus = row.previous_status === "rescheduled" ? "rescheduled" : "scheduled"
  const nextStatus = action === "approved" ? "cancelled" : restoredStatus

  const { error: updateError } = await admin
    .from("appointments")
    .update({ status: nextStatus, previous_status: null, updated_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "cancellation_requested")

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 })
  }

  await admin.from("notifications").insert([
    {
      user_id: requestData.client.id,
      created_by: auth.user.id,
      type: "appointment_update",
      title: action === "approved" ? "Cancellation Approved" : "Cancellation Rejected",
      description:
        action === "approved"
          ? `Your cancellation request for "${requestData.case_title}" has been approved.`
          : `Your cancellation request for "${requestData.case_title}" was rejected. Please attend your appointment as scheduled.${reason ? ` Reason: ${reason}` : ""}`,
      data: { appointment_id: requestId, status: nextStatus },
    },
    {
      user_id: requestData.lawyer.id,
      created_by: auth.user.id,
      type: "appointment_update",
      title: action === "approved" ? "Cancellation Approved" : "Cancellation Rejected",
      description:
        action === "approved"
          ? `The cancellation request for "${requestData.case_title}" has been approved.`
          : `The cancellation request for "${requestData.case_title}" was rejected. The appointment remains active.${reason ? ` Reason: ${reason}` : ""}`,
      data: { appointment_id: requestId, status: nextStatus },
    },
  ])

  if (requestData.case_id) {
    await appendCaseTimelineEvent(admin, {
      caseId: requestData.case_id,
      actorId: auth.user.id,
      eventType: CaseTimelineEventType.CANCELLATION_RESOLVED,
      metadata: { appointment_id: requestId, resolution: action, reason: reason || undefined },
    })
  }

  await sendResolutionEmails(req, requestData, action, reason)

  return NextResponse.json({ success: true, status: nextStatus })
}
