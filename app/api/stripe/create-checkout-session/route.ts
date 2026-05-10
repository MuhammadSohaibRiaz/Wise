import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe/config"
import { createClient } from "@/lib/supabase/server"

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
    const { appointmentId, amount, currency = "usd", paymentId } = body

    if (!appointmentId || !amount || !paymentId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Verify appointment belongs to user and is in awaiting_payment status
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

    // Create Stripe Checkout Session
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
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${request.headers.get("origin") || "http://localhost:3000"}/client/appointments?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.headers.get("origin") || "http://localhost:3000"}/client/appointments?payment=cancelled`,
      metadata: {
        appointment_id: appointmentId,
        payment_id: paymentId,
        client_id: user.id,
        case_id: appointment.case_id,
        lawyer_id: appointment.lawyer_id || null,
      },
    })

    if (session.id) {
      const { error: checkoutMetaErr } = await supabase
        .from("payments")
        .update({ stripe_checkout_session_id: session.id, updated_at: new Date().toISOString() })
        .eq("id", paymentId)
      if (checkoutMetaErr) {
        console.warn("[Stripe] stripe_checkout_session_id column missing or update failed:", checkoutMetaErr.message)
      }
    }

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error("[Stripe] Create checkout session error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

