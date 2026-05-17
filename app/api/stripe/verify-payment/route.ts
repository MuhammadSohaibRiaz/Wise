import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe/config"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
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

            const admin = createAdminClient()
            const { data: appointmentForAuth, error: appointmentAuthError } = await admin
                .from("appointments")
                .select("id, client_id, status, case_id")
                .eq("id", appointment_id)
                .maybeSingle()

            if (appointmentAuthError || !appointmentForAuth || appointmentForAuth.client_id !== user.id) {
                return NextResponse.json({ error: "Appointment is not available for this user" }, { status: 403 })
            }

            // Update payment status
            const { error: paymentError } = await admin
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

            const { data: updatedAppointment, error: appointmentError } = await admin
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
                if (["scheduled", "rescheduled", "attended", "completed"].includes(appointmentForAuth.status)) {
                    return NextResponse.json({ success: true, status: "completed", alreadyProcessed: true })
                }

                return NextResponse.json(
                    { error: "Appointment is no longer available for payment" },
                    { status: 400 },
                )
            }

            // Payment confirms/schedules the consultation only. Case work starts
            // after the consultation is explicitly marked as held.
            if (updatedAppointment?.case_id) {
                console.log(`[Payment Verify] Consultation ${appointment_id} scheduled for case ${updatedAppointment.case_id}`)
                await appendCaseTimelineEvent(admin, {
                    caseId: updatedAppointment.case_id,
                    actorId: user.id,
                    eventType: CaseTimelineEventType.PAYMENT_COMPLETED,
                    metadata: { appointment_id, payment_id, source: "verify_payment" },
                })
            }

            // Create notifications
            const { data: appointment } = await admin
                .from("appointments")
                .select("client_id, lawyer_id, cases(title)")
                .eq("id", appointment_id)
                .single()

            if (appointment) {
                const caseTitle = (appointment.cases as any)?.title || (Array.isArray(appointment.cases) ? (appointment.cases[0] as any)?.title : "consultation")

                await admin.from("notifications").insert({
                    user_id: appointment.client_id,
                    created_by: user.id,
                    type: "payment_update",
                    title: "Payment Successful",
                    description: `Your payment for "${caseTitle}" has been confirmed.`,
                    data: { appointment_id, payment_id },
                })

                if (appointment.lawyer_id) {
                    await admin.from("notifications").insert({
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
