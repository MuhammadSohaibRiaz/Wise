import { NextRequest, NextResponse } from "next/server"

import {
  cancellationRequesterLabel,
  type CancellationRequester,
} from "@/lib/appointments/cancellation-request"
import {
  closeCaseOnCancellationApprove,
  fetchCompletedPaymentForCase,
  type PaymentSummary,
} from "@/lib/admin/cancellation-refund"
import { appendCaseTimelineEvent, CaseTimelineEventType } from "@/lib/case-timeline"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

type Resolution = "approved" | "rejected"

function buildResolutionNotifications(
  request: ReturnType<typeof mapRequest>,
  action: Resolution,
  requestedBy: CancellationRequester | null,
  reason: string,
) {
  const requesterLabel = cancellationRequesterLabel(requestedBy).toLowerCase()
  const title =
    action === "approved" ? "Cancellation Approved" : "Cancellation Rejected"

  const refundNote =
    action === "approved"
      ? " If a payment was made, an admin may process a refund to your original payment method separately."
      : ""

  const clientDescription =
    action === "approved"
      ? requestedBy === "client"
        ? `Your cancellation request for "${request.case_title}" was approved. The appointment has been cancelled and the case is closed.${refundNote}${reason ? ` Admin note: ${reason}` : ""}`
        : `The ${requesterLabel}'s cancellation request for "${request.case_title}" was approved. The appointment has been cancelled.${refundNote}${reason ? ` Admin note: ${reason}` : ""}`
      : requestedBy === "client"
        ? `Your cancellation request for "${request.case_title}" was rejected. The appointment remains active.${reason ? ` Reason: ${reason}` : ""}`
        : `The ${requesterLabel}'s cancellation request for "${request.case_title}" was rejected. The appointment remains active.${reason ? ` Reason: ${reason}` : ""}`

  const lawyerDescription =
    action === "approved"
      ? requestedBy === "lawyer"
        ? `Your cancellation request for "${request.case_title}" was approved. The appointment has been cancelled.${refundNote}${reason ? ` Admin note: ${reason}` : ""}`
        : `The ${requesterLabel}'s cancellation request for "${request.case_title}" was approved. The consultation is cancelled; any client refund will be processed separately.${reason ? ` Admin note: ${reason}` : ""}`
      : requestedBy === "lawyer"
        ? `Your cancellation request for "${request.case_title}" was rejected. The appointment remains scheduled.${reason ? ` Reason: ${reason}` : ""}`
        : `The ${requesterLabel}'s cancellation request for "${request.case_title}" was rejected. The appointment remains scheduled.${reason ? ` Reason: ${reason}` : ""}`

  return [
    {
      user_id: request.client.id,
      title,
      description: clientDescription,
    },
    {
      user_id: request.lawyer.id,
      title,
      description: lawyerDescription,
    },
  ]
}

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
    cancellation_requested_by: apt.cancellation_requested_by || null,
    cancellation_request_message: apt.cancellation_request_message || null,
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
          requested_by: request.cancellation_requested_by,
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
          requested_by: request.cancellation_requested_by,
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
      cancellation_requested_by,
      cancellation_request_message,
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

  const requests = await Promise.all(
    (data || []).map(async (apt) => {
      const mapped = mapRequest(apt)
      const payment =
        mapped.case_id && mapped.client.id && mapped.lawyer.id
          ? await fetchCompletedPaymentForCase(admin, mapped.case_id, mapped.client.id, mapped.lawyer.id)
          : null
      return { ...mapped, payment, refund_eligible: Boolean(payment?.stripe_payment_id) }
    }),
  )

  const { data: cancelledRows } = await admin
    .from("appointments")
    .select(`
      id,
      scheduled_at,
      duration_minutes,
      reschedule_count,
      cancellation_requested_by,
      case_id,
      client_id,
      lawyer_id,
      cases ( id, title, case_type ),
      client:profiles!appointments_client_id_fkey ( id, first_name, last_name, email ),
      lawyer:profiles!appointments_lawyer_id_fkey ( id, first_name, last_name, email )
    `)
    .eq("status", "cancelled")
    .order("updated_at", { ascending: false })
    .limit(50)

  const awaiting_refund: Array<ReturnType<typeof mapRequest> & { payment: PaymentSummary; refund_eligible: boolean }> = []

  for (const apt of cancelledRows || []) {
    const mapped = mapRequest(apt)
    if (!mapped.case_id || !mapped.client.id || !mapped.lawyer.id) continue
    const payment = await fetchCompletedPaymentForCase(
      admin,
      mapped.case_id,
      mapped.client.id,
      mapped.lawyer.id,
    )
    if (!payment?.stripe_payment_id) continue
    awaiting_refund.push({
      ...mapped,
      payment,
      refund_eligible: true,
    })
  }

  return NextResponse.json({
    requests,
    awaiting_refund,
    pending_count: requests.length,
    awaiting_refund_count: awaiting_refund.length,
  })
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
      cancellation_requested_by,
      cancellation_request_message,
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
  const requestedBy = (row.cancellation_requested_by as CancellationRequester | null) || null
  const restoredStatus = row.previous_status === "rescheduled" ? "rescheduled" : "scheduled"
  const nextStatus = action === "approved" ? "cancelled" : restoredStatus

  const { data: updatedRows, error: updateError } = await admin
    .from("appointments")
    .update({
      status: nextStatus,
      previous_status: null,
      cancellation_request_message: null,
      cancellation_requested_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("status", "cancellation_requested")
    .select("id")

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 })
  }
  if (!updatedRows?.length) {
    return NextResponse.json(
      { error: "This request was already resolved or the appointment status changed. Refresh the list." },
      { status: 409 },
    )
  }

  const resolutionNotes = buildResolutionNotifications(requestData, action, requestedBy, reason)
  await admin.from("notifications").insert(
    resolutionNotes.map((note) => ({
      user_id: note.user_id,
      created_by: auth.user!.id,
      type: "appointment_update",
      title: note.title,
      description: note.description,
      data: {
        appointment_id: requestId,
        status: nextStatus,
        resolution: action,
        cancellation_requested_by: requestedBy,
      },
    })),
  )

  if (requestData.case_id) {
    await appendCaseTimelineEvent(admin, {
      caseId: requestData.case_id,
      actorId: auth.user.id,
      eventType: CaseTimelineEventType.CANCELLATION_RESOLVED,
      metadata: {
        appointment_id: requestId,
        resolution: action,
        reason: reason || undefined,
        requested_by_role: requestedBy,
        restored_status: action === "rejected" ? restoredStatus : undefined,
      },
    })
  }

  let payment: PaymentSummary | null = null
  let refund_eligible = false

  if (action === "approved" && requestData.case_id) {
    await closeCaseOnCancellationApprove(admin, requestData.case_id)
    payment = await fetchCompletedPaymentForCase(
      admin,
      requestData.case_id,
      requestData.client.id,
      requestData.lawyer.id,
    )
    refund_eligible = Boolean(payment?.stripe_payment_id)
  }

  await sendResolutionEmails(req, requestData, action, reason)

  return NextResponse.json({
    success: true,
    status: nextStatus,
    payment,
    refund_eligible,
    case_closed: action === "approved",
  })
}
