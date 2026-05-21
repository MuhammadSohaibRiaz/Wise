import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe/config"
import { createClient } from "@/lib/supabase/server"
import { APP_CURRENCY_CODE } from "@/lib/currency"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { appointmentId, amount, currency = APP_CURRENCY_CODE, paymentId, returnTo } = body

    if (!appointmentId || !amount || !paymentId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const numericAmount = Number(amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 50000) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 })
    }

    // Verify the appointment belongs to the authenticated client and is exactly
    // at the payment step. This prevents paying for someone else's appointment
    // or re-paying an already confirmed slot.
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select("id, client_id, lawyer_id, status, case_id, cases(title)")
      .eq("id", appointmentId)
      .eq("client_id", user.id)
      .eq("status", "awaiting_payment")
      .single()

    if (appointmentError || !appointment) {
      return NextResponse.json({ error: "Appointment not found or invalid" }, { status: 404 })
    }

    const { data: paymentRow, error: paymentError } = await supabase
      .from("payments")
      .select("id, client_id, appointment_id, amount, status")
      .eq("id", paymentId)
      .eq("client_id", user.id)
      .eq("status", "pending")
      .maybeSingle()

    if (paymentError || !paymentRow) {
      return NextResponse.json({ error: "Payment not found or already completed" }, { status: 404 })
    }

    if (paymentRow.appointment_id && paymentRow.appointment_id !== appointmentId) {
      return NextResponse.json({ error: "Payment does not match this appointment" }, { status: 400 })
    }

    // Prefer the configured production URL; fall back to the request origin for
    // local/dev previews so Stripe redirects back to the right environment.
    const siteUrl = (
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : null) ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      request.headers.get("origin") ||
      "http://localhost:3000"
    ).replace(/\/$/, "")

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: `Consultation: ${(appointment.cases as any)?.title || (Array.isArray(appointment.cases) ? (appointment.cases[0] as any)?.title : "Appointment")}`,
              description: `Payment for appointment ${appointmentId}`,
            },
            unit_amount: Math.round(numericAmount * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url:
        returnTo === "payments"
          ? `${siteUrl}/client/payments?payment=success&session_id={CHECKOUT_SESSION_ID}`
          : `${siteUrl}/client/appointments?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:
        returnTo === "payments"
          ? `${siteUrl}/client/payments?payment=cancelled`
          : `${siteUrl}/client/appointments?payment=cancelled`,
      metadata: {
        appointment_id: appointmentId,
        payment_id: paymentId,
        client_id: user.id,
        case_id: appointment.case_id,
        lawyer_id: appointment.lawyer_id || null,
      },
    })

    if (session.id) {
      // Store the Checkout session for later verification/debugging. Older DBs
      // may not have this column, so failure is logged but not fatal.
      const { error: checkoutMetaErr } = await supabase
        .from("payments")
        .update({ stripe_checkout_session_id: session.id, updated_at: new Date().toISOString() })
        .eq("id", paymentId)
      if (checkoutMetaErr) {
        console.warn("[Stripe] stripe_checkout_session_id column missing or update failed:", checkoutMetaErr.message)
      }
    }

    if (!session.url) {
      return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error("[Stripe] Create checkout session error:", error)
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 })
  }
}
