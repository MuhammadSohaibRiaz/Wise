import type { SupabaseClient } from "@supabase/supabase-js"

export type PaymentSummary = {
  id: string
  amount: number
  currency: string
  status: string
  stripe_payment_id: string | null
  payment_method: string | null
}

export async function fetchCompletedPaymentForCase(
  admin: SupabaseClient,
  caseId: string,
  clientId: string,
  lawyerId: string,
): Promise<PaymentSummary | null> {
  const { data } = await admin
    .from("payments")
    .select("id, amount, currency, status, stripe_payment_id, payment_method")
    .eq("case_id", caseId)
    .eq("client_id", clientId)
    .eq("lawyer_id", lawyerId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null
  return {
    id: data.id,
    amount: Number(data.amount),
    currency: data.currency || "PKR",
    status: data.status,
    stripe_payment_id: data.stripe_payment_id,
    payment_method: data.payment_method,
  }
}

export async function closeCaseOnCancellationApprove(
  admin: SupabaseClient,
  caseId: string,
): Promise<void> {
  await admin
    .from("cases")
    .update({ status: "closed", updated_at: new Date().toISOString() })
    .eq("id", caseId)
    .in("status", ["open", "in_progress", "pending_completion"])
}
