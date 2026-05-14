import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe/config"
import { createClient } from "@/lib/supabase/server"
import { appendCaseTimelineEvent, CaseTimelineEventType } from "@/lib/case-timeline"

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { sessionId } = await request.json()

        if (!sessionId) {
            return NextResponse.json({ error: "Missing session ID" }, { status: 400 })
        }

        console.log(`[Payment Verify] Checking session: ${sessionId}`)

        // Retrieve the checkout session from Stripe
        const session = await stripe.checkout.sessions.retrieve(sessionId)

        console.log(`[Payment Verify] Session status: ${session.payment_status}`)
        console.log(`[Payment Verify] Metadata:`, session.metadata)

        if (session.payment_status === "paid") {
            const { appointment_id, payment_id } = session.metadata || {}

            if (!appointment_id || !payment_id) {
                return NextResponse.json({ error: "Invalid session metadata" }, { status: 400 })
            }

            console.log(`[Payment Verify] Payment confirmed for appointment ${appointment_id}`)

            // Update payment status
            const { error: paymentError } = await supabase
                .from("payments")
                .update({
                    status: "completed",
                    payment_method: session.payment_method_types?.[0] || "card",
                    stripe_payment_id: (session.payment_intent as string) || session.id,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", payment_id)

            if (paymentError) {
                console.error("[Payment Verify] Error updating payment:", paymentError)
            } else {
                console.log(`[Payment Verify] ✅ Payment ${payment_id} marked as completed`)
            }

            const { data: updatedAppointment, error: appointmentError } = await supabase
                .from("appointments")
                .update({
                    status: "scheduled",
                    updated_at: new Date().toISOString(),
                })
                .eq("id", appointment_id)
                .eq("status", "awaiting_payment")
                .select("case_id")
                .maybeSingle()

            if (appointmentError) {
                console.error("[Payment Verify] Error updating appointment:", appointmentError)
            }

            if (!updatedAppointment && !appointmentError) {
                return NextResponse.json(
                    { error: "Appointment is no longer available for payment" },
                    { status: 400 },
                )
            }

            // Update case status to in_progress
            if (updatedAppointment?.case_id) {
                const { error: caseError } = await supabase
                    .from("cases")
                    .update({
                        status: "in_progress",
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", updatedAppointment.case_id)

                if (caseError) {
                    console.error("[Payment Verify] Error updating case:", caseError)
                } else {
                    console.log(`[Payment Verify] ✅ Case ${updatedAppointment.case_id} marked as in_progress`)
                    await appendCaseTimelineEvent(supabase, {
                        caseId: updatedAppointment.case_id,
                        actorId: user.id,
                        eventType: CaseTimelineEventType.PAYMENT_COMPLETED,
                        metadata: { appointment_id, payment_id, source: "verify_payment" },
                    })
                    await appendCaseTimelineEvent(supabase, {
                        caseId: updatedAppointment.case_id,
                        actorId: user.id,
                        eventType: CaseTimelineEventType.CASE_ACTIVATED,
                        metadata: { source: "verify_payment" },
                    })
                }
            }

            // Create notifications
            const { data: appointment } = await supabase
                .from("appointments")
                .select("client_id, lawyer_id, cases(title)")
                .eq("id", appointment_id)
                .single()

            if (appointment) {
                const caseTitle = (appointment.cases as any)?.title || (Array.isArray(appointment.cases) ? (appointment.cases[0] as any)?.title : "consultation")

                await supabase.from("notifications").insert({
                    user_id: appointment.client_id,
                    created_by: user.id,
                    type: "payment_update",
                    title: "Payment Successful",
                    description: `Your payment for "${caseTitle}" has been confirmed.`,
                    data: { appointment_id, payment_id },
                })

                if (appointment.lawyer_id) {
                    await supabase.from("notifications").insert({
                        user_id: appointment.lawyer_id,
                        created_by: user.id,
                        type: "payment_update",
                        title: "Payment Received",
                        description: `Payment received for consultation "${caseTitle}".`,
                        data: { appointment_id, payment_id },
                    })
                }

                console.log(`[Payment Verify] ✅ Notifications sent`)
            }

            return NextResponse.json({ success: true, status: "completed" })
        }

        return NextResponse.json({ success: true, status: session.payment_status })
    } catch (error: any) {
        console.error("[Payment Verify] Error:", error)
        return NextResponse.json({ error: error.message || "Verification failed" }, { status: 500 })
    }
}
