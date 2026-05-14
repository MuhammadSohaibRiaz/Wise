import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe/config"
import { createClient } from "@/lib/supabase/server"
import Stripe from "stripe"
import { appendCaseTimelineEvent, CaseTimelineEventType } from "@/lib/case-timeline"
import { sendEmail, buildEmailHtml } from "@/lib/email"

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

if (!webhookSecret) {
  console.warn("STRIPE_WEBHOOK_SECRET is not set - webhook verification will be skipped")
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get("stripe-signature")

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } else {
      // For development, parse without verification
      event = JSON.parse(body) as Stripe.Event
    }
  } catch (error: any) {
    console.error("[Stripe] Webhook signature verification failed:", error.message)
    return NextResponse.json({ error: `Webhook Error: ${error.message}` }, { status: 400 })
  }

  const supabase = await createClient()

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        const { appointment_id, payment_id } = session.metadata || {}

        if (appointment_id && payment_id) {
          // Update payment status
          await supabase
            .from("payments")
            .update({
              status: "completed",
              payment_method: session.payment_method_types?.[0] || "card",
              stripe_payment_id: session.payment_intent as string || session.id,
              updated_at: new Date().toISOString(),
            })
            .eq("id", payment_id)

          const { data: updatedAppointment } = await supabase
            .from("appointments")
            .update({
              status: "scheduled",
              updated_at: new Date().toISOString(),
            })
            .eq("id", appointment_id)
            .eq("status", "awaiting_payment")
            .select("case_id")
            .maybeSingle()

          if (updatedAppointment?.case_id) {
            await supabase
              .from("cases")
              .update({
                status: "in_progress",
                updated_at: new Date().toISOString(),
              })
              .eq("id", updatedAppointment.case_id)

            await appendCaseTimelineEvent(supabase, {
              caseId: updatedAppointment.case_id,
              actorId: null,
              eventType: CaseTimelineEventType.PAYMENT_COMPLETED,
              metadata: { appointment_id, payment_id, source: "stripe_webhook_checkout" },
            })
            await appendCaseTimelineEvent(supabase, {
              caseId: updatedAppointment.case_id,
              actorId: null,
              eventType: CaseTimelineEventType.CASE_ACTIVATED,
              metadata: { source: "stripe_webhook_checkout" },
            })

            console.log(`[Stripe] Updated case ${updatedAppointment.case_id} to in_progress`)
          }

          const { data: appointment } = await supabase
            .from("appointments")
            .select("client_id, lawyer_id, cases(title)")
            .eq("id", appointment_id)
            .single()

          if (appointment) {
            const caseTitle = (appointment.cases as any)?.title || (Array.isArray(appointment.cases) ? (appointment.cases[0] as any)?.title : "consultation")

            await supabase.from("notifications").insert({
              user_id: appointment.client_id,
              created_by: appointment.client_id,
              type: "payment_update",
              title: "Payment Successful",
              description: `Your payment for "${caseTitle}" has been confirmed.`,
              data: { appointment_id, payment_id },
            })

            if (appointment.lawyer_id) {
              await supabase.from("notifications").insert({
                user_id: appointment.lawyer_id,
                created_by: appointment.client_id,
                type: "payment_update",
                title: "Payment Received",
                description: `Payment received for consultation "${caseTitle}".`,
                data: { appointment_id, payment_id },
              })
            }

            // Email notification to client
            const siteUrl = (
              process.env.NEXT_PUBLIC_SITE_URL ||
              (process.env.VERCEL_PROJECT_PRODUCTION_URL
                ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
                : null) ||
              (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
              "http://localhost:3000"
            ).replace(/\/$/, "")
            try {
              const { data: clientProfile } = await supabase
                .from("profiles")
                .select("email")
                .eq("id", appointment.client_id)
                .single()
              if (clientProfile?.email) {
                await sendEmail({
                  to: clientProfile.email,
                  subject: "Payment Confirmed — Consultation Scheduled",
                  html: buildEmailHtml({
                    title: "Payment Confirmed",
                    body: `Your payment for <strong>"${caseTitle}"</strong> has been received and your consultation has been scheduled. You'll find the details in your appointments.`,
                    ctaText: "View Appointments",
                    ctaUrl: `${siteUrl}/client/appointments`,
                  }),
                })
              }
            } catch { /* email is supplementary */ }
          }

          console.log(`[Stripe] Payment succeeded for appointment ${appointment_id}`)
        }
        break
      }

      case "payment_intent.succeeded": {
        // Idempotent fallback — checkout.session.completed already handles the full flow.
        // This only ensures the payment record is marked completed if it wasn't already.
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const { payment_id } = paymentIntent.metadata

        if (payment_id) {
          await supabase
            .from("payments")
            .update({
              status: "completed",
              payment_method: paymentIntent.payment_method_types[0] || "card",
              stripe_payment_id: paymentIntent.id,
              updated_at: new Date().toISOString(),
            })
            .eq("id", payment_id)

          console.log(`[Stripe] payment_intent.succeeded — ensured payment ${payment_id} is marked completed`)
        }
        break
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const { appointment_id, payment_id } = paymentIntent.metadata

        if (payment_id) {
          await supabase
            .from("payments")
            .update({
              status: "failed",
              updated_at: new Date().toISOString(),
            })
            .eq("id", payment_id)

          // Create notification for payment failure
          if (appointment_id) {
            const { data: appointment } = await supabase
              .from("appointments")
              .select("client_id, lawyer_id, cases(title)")
              .eq("id", appointment_id)
              .single()

            if (appointment) {
              const caseTitle = (appointment.cases as any)?.title || (Array.isArray(appointment.cases) ? (appointment.cases[0] as any)?.title : "consultation")

              // Notify client
              await supabase.from("notifications").insert({
                user_id: appointment.client_id,
                type: "payment_update",
                title: "Payment Failed",
                description: `Payment failed for "${caseTitle}". Please try again.`,
                data: { appointment_id, payment_id, status: "failed" },
              })

              // Notify lawyer
              if (appointment.lawyer_id) {
                const caseTitle = (appointment.cases as any)?.title || (Array.isArray(appointment.cases) ? (appointment.cases[0] as any)?.title : "consultation")
                await supabase.from("notifications").insert({
                  user_id: appointment.lawyer_id,
                  type: "payment_update",
                  title: "Payment Failed",
                  description: `Client payment failed for "${caseTitle}".`,
                  data: { appointment_id, payment_id, status: "failed" },
                })
              }
            }
          }

          console.log(`[Stripe] Payment failed for payment ${payment_id}`)
        }
        break
      }

      default:
        console.log(`[Stripe] Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error("[Stripe] Webhook processing error:", error)
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}

