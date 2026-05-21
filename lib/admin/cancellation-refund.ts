import type { SupabaseClient } from "@supabase/supabase-js"

import { stripe } from "@/lib/stripe/config"

export const REFUND_ARRIVAL_MESSAGE =
  "Funds typically return to the client's original card within 5–7 business days."

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

export function isStripeAlreadyRefundedError(e: unknown): boolean {
  const err = e as { code?: string; message?: string }
  const code = err?.code || ""
  const message = err?.message || ""
  return (
    code === "charge_already_refunded" ||
    /already been refunded/i.test(message) ||
    /has already been refunded/i.test(message)
  )
}

/** True when Stripe shows a full refund for this PaymentIntent. */
export async function isStripePaymentFullyRefunded(paymentIntentId: string): Promise<boolean> {
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
    const refunds = await stripe.refunds.list({ payment_intent: paymentIntentId, limit: 100 })
    const totalRefunded = refunds.data.reduce((sum, r) => sum + (r.amount || 0), 0)
    const paid = pi.amount_received ?? pi.amount
    return totalRefunded >= paid && totalRefunded > 0
  } catch {
    return false
  }
}

/**
 * If Stripe already refunded but DB still says completed, mark refunded in DB.
 * Returns true when the payment should no longer appear in "awaiting refund".
 */
export async function syncPaymentRefundedFromStripe(
  admin: SupabaseClient,
  payment: PaymentSummary,
): Promise<boolean> {
  if (payment.status === "refunded") return true
  if (payment.status !== "completed" || !payment.stripe_payment_id) return false

  const refundedOnStripe = await isStripePaymentFullyRefunded(payment.stripe_payment_id)
  if (!refundedOnStripe) return false

  await admin
    .from("payments")
    .update({ status: "refunded", updated_at: new Date().toISOString() })
    .eq("id", payment.id)
    .eq("status", "completed")

  return true
}

export async function markPaymentRefunded(
  admin: SupabaseClient,
  paymentId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("payments")
    .update({ status: "refunded", updated_at: new Date().toISOString() })
    .eq("id", paymentId)
    .in("status", ["completed", "pending"])
    .select("id")
    .maybeSingle()
  return Boolean(data?.id)
}
