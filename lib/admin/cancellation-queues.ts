import type { SupabaseClient } from "@supabase/supabase-js"

import type { CancellationRequester } from "@/lib/appointments/cancellation-request"
import {
  fetchCompletedPaymentForCase,
  syncPaymentRefundedFromStripe,
  type PaymentSummary,
} from "@/lib/admin/cancellation-refund"

export type AdminCancellationRequest = {
  id: string
  scheduled_at: string
  duration_minutes: number
  reschedule_count: number
  previous_status: string | null
  cancellation_requested_by: CancellationRequester | null
  cancellation_request_message: string | null
  case_id: string
  case_title: string
  case_type: string
  payment: PaymentSummary | null
  refund_eligible: boolean
  client: {
    id: string
    first_name: string
    last_name: string
    email: string
  }
  lawyer: {
    id: string
    first_name: string
    last_name: string
    email: string
  }
}

export type AdminCancellationQueues = {
  requests: AdminCancellationRequest[]
  awaiting_refund: AdminCancellationRequest[]
  pending_count: number
  awaiting_refund_count: number
  total_actionable: number
}

function mapRequest(apt: Record<string, unknown>): Omit<AdminCancellationRequest, "payment" | "refund_eligible"> {
  const cases = apt.cases as { id?: string; title?: string; case_type?: string } | { id?: string; title?: string; case_type?: string }[] | null
  const caseRow = Array.isArray(cases) ? cases[0] : cases
  const client = apt.client as AdminCancellationRequest["client"] | null
  const lawyer = apt.lawyer as AdminCancellationRequest["lawyer"] | null

  return {
    id: apt.id as string,
    scheduled_at: apt.scheduled_at as string,
    duration_minutes: (apt.duration_minutes as number) || 60,
    reschedule_count: (apt.reschedule_count as number) || 0,
    previous_status: (apt.previous_status as string | null) || null,
    cancellation_requested_by: (apt.cancellation_requested_by as CancellationRequester | null) || null,
    cancellation_request_message: (apt.cancellation_request_message as string | null) || null,
    case_id: caseRow?.id || (apt.case_id as string) || "",
    case_title: caseRow?.title || "Unknown",
    case_type: caseRow?.case_type || "",
    client: client || { id: "", first_name: "Unknown", last_name: "", email: "" },
    lawyer: lawyer || { id: "", first_name: "Unknown", last_name: "", email: "" },
  }
}

const appointmentSelect = `
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
`

async function attachPayment(
  admin: SupabaseClient,
  mapped: Omit<AdminCancellationRequest, "payment" | "refund_eligible">,
): Promise<AdminCancellationRequest> {
  const payment =
    mapped.case_id && mapped.client.id && mapped.lawyer.id
      ? await fetchCompletedPaymentForCase(admin, mapped.case_id, mapped.client.id, mapped.lawyer.id)
      : null
  return {
    ...mapped,
    payment,
    refund_eligible: Boolean(payment?.stripe_payment_id),
  }
}

/** Single source of truth for admin cancellation lists and counts. */
export async function fetchAdminCancellationQueues(
  admin: SupabaseClient,
): Promise<AdminCancellationQueues> {
  const { data: pendingRows, error: pendingError } = await admin
    .from("appointments")
    .select(appointmentSelect)
    .eq("status", "cancellation_requested")
    .order("updated_at", { ascending: false })

  if (pendingError) {
    throw new Error(pendingError.message)
  }

  const requests = await Promise.all(
    (pendingRows || []).map((apt) => attachPayment(admin, mapRequest(apt as Record<string, unknown>))),
  )

  const { data: cancelledRows, error: cancelledError } = await admin
    .from("appointments")
    .select(appointmentSelect)
    .eq("status", "cancelled")
    .order("updated_at", { ascending: false })
    .limit(100)

  if (cancelledError) {
    throw new Error(cancelledError.message)
  }

  const awaiting_refund: AdminCancellationRequest[] = []
  for (const apt of cancelledRows || []) {
    const mapped = mapRequest(apt as Record<string, unknown>)
    if (!mapped.case_id || !mapped.client.id || !mapped.lawyer.id) continue
    const withPayment = await attachPayment(admin, mapped)
    if (!withPayment.payment) continue

    const syncedAway = await syncPaymentRefundedFromStripe(admin, withPayment.payment)
    if (syncedAway) continue

    awaiting_refund.push(withPayment)
  }

  return {
    requests,
    awaiting_refund,
    pending_count: requests.length,
    awaiting_refund_count: awaiting_refund.length,
    total_actionable: requests.length + awaiting_refund.length,
  }
}
