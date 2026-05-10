import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe/config"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    console.log("[Stripe API] create-payment-intent called")
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError) {
      console.error("[Stripe API] Auth error:", authError)
      return NextResponse.json({ error: "Authentication error" }, { status: 401 })
    }

    if (!user) {
      console.warn("[Stripe API] No user found")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[Stripe API] User authenticated:", user.id)

    const body = await request.json()
    const { appointmentId, amount, currency = "usd" } = body

    console.log("[Stripe API] Request body:", { appointmentId, amount, currency })

    if (!appointmentId || !amount) {
      console.warn("[Stripe API] Missing required fields")
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Verify appointment belongs to user and is in awaiting_payment status
    console.log("[Stripe API] Querying appointment:", appointmentId)
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select("id, client_id, lawyer_id, status, case_id, duration_minutes, cases(hourly_rate)")
      .eq("id", appointmentId)
      .eq("client_id", user.id)
      .eq("status", "awaiting_payment")
      .single()

    if (appointmentError) {
      console.error("[Stripe API] Appointment query error:", appointmentError)
      console.error("[Stripe API] Error details:", {
        code: appointmentError.code,
        message: appointmentError.message,
        details: appointmentError.details,
        hint: appointmentError.hint,
      })
      
      // Try to get more info about the appointment
      const { data: checkAppointment } = await supabase
        .from("appointments")
        .select("id, client_id, status")
        .eq("id", appointmentId)
        .single()
      
      console.log("[Stripe API] Appointment check result:", checkAppointment)
      
      if (checkAppointment) {
        if (checkAppointment.client_id !== user.id) {
          return NextResponse.json({ 
            error: "Appointment does not belong to this user",
            details: `Expected client_id: ${user.id}, Found: ${checkAppointment.client_id}`
          }, { status: 403 })
        }
        if (checkAppointment.status !== "awaiting_payment") {
          return NextResponse.json({ 
            error: "Appointment is not in awaiting_payment status",
            details: `Current status: ${checkAppointment.status}`
          }, { status: 400 })
        }
      }
      
      return NextResponse.json({ 
        error: "Appointment not found or invalid",
        details: appointmentError.message 
      }, { status: 404 })
    }

    if (!appointment) {
      console.warn("[Stripe API] Appointment not found")
      return NextResponse.json({ error: "Appointment not found or invalid" }, { status: 404 })
    }

    console.log("[Stripe API] Appointment found:", {
      id: appointment.id,
      status: appointment.status,
      client_id: appointment.client_id,
      lawyer_id: appointment.lawyer_id,
    })

    // Calculate amount in cents
    const amountInCents = Math.round(amount * 100)

    // Get hourly rate from cases relation
    const hourlyRate = (appointment.cases as any)?.hourly_rate || 0
    const durationMinutes = appointment.duration_minutes || 60
    
    console.log("[Stripe API] Payment calculation:", {
      hourlyRate,
      durationMinutes,
      calculatedAmount: (hourlyRate * durationMinutes) / 60,
      providedAmount: amount,
    })

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        appointment_id: appointmentId,
        case_id: appointment.case_id,
        client_id: user.id,
        lawyer_id: appointment.lawyer_id || null,
        amount: amount,
        currency: currency.toUpperCase(),
        status: "pending",
        description: `Payment for appointment ${appointmentId}`,
      })
      .select()
      .single()

    if (paymentError) {
      console.error("[Stripe] Payment record creation error:", paymentError)
      return NextResponse.json({ error: "Failed to create payment record" }, { status: 500 })
    }

    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: currency.toLowerCase(),
      metadata: {
        appointment_id: appointmentId,
        payment_id: payment.id,
        client_id: user.id,
        case_id: appointment.case_id,
      },
      description: `Payment for appointment ${appointmentId}`,
    })

    // Update payment record with Stripe payment ID
    await supabase
      .from("payments")
      .update({ stripe_payment_id: paymentIntent.id })
      .eq("id", payment.id)

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentId: payment.id,
    })
  } catch (error: any) {
    console.error("[Stripe] Create payment intent error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

