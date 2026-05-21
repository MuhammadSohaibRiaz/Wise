import { NextResponse } from "next/server"

import { fetchCompletedPaymentForCase } from "@/lib/admin/cancellation-refund"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_type")
    .eq("id", user.id)
    .maybeSingle()

  if (profile?.user_type !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const admin = createAdminClient()

  const { count: pendingCount } = await admin
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("status", "cancellation_requested")

  const { data: cancelledRows } = await admin
    .from("appointments")
    .select("id, case_id, client_id, lawyer_id")
    .eq("status", "cancelled")
    .order("updated_at", { ascending: false })
    .limit(50)

  let awaitingRefundCount = 0
  for (const apt of cancelledRows || []) {
    if (!apt.case_id) continue
    const payment = await fetchCompletedPaymentForCase(
      admin,
      apt.case_id,
      apt.client_id,
      apt.lawyer_id,
    )
    if (payment?.stripe_payment_id) awaitingRefundCount++
  }

  return NextResponse.json({
    pending_count: pendingCount ?? 0,
    awaiting_refund_count: awaitingRefundCount,
    total_actionable: (pendingCount ?? 0) + awaitingRefundCount,
  })
}
