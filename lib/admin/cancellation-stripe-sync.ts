import type { SupabaseClient } from "@supabase/supabase-js"

import type { PaymentSummary } from "@/lib/admin/cancellation-refund"
import { stripe } from "@/lib/stripe/config"

/** True when Stripe shows a full refund for this PaymentIntent. Server-only. */
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
