import { NextRequest, NextResponse } from "next/server"

import { fetchCompletedPaymentForCase } from "@/lib/admin/cancellation-refund"
import { appendCaseTimelineEvent, CaseTimelineEventType } from "@/lib/case-timeline"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { stripe } from "@/lib/stripe/config"

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("user_type")
    .eq("id", user.id)
    .maybeSingle()

  if (error || profile?.user_type !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { user }
}

async function sendRefundEmails(
  req: NextRequest,
  data: {
    client_id: string
    lawyer_id: string
    case_title: string
    amount: number
    currency: string
  },
) {
  const origin = req.nextUrl.origin
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (process.env.CRON_SECRET) headers["x-cron-secret"] = process.env.CRON_SECRET

  await Promise.allSettled([
    fetch(`${origin}/api/notify/email`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        template: "appointment_cancellation_refunded",
        data: {
          recipient_id: data.client_id,
          case_title: data.case_title,
          amount: String(data.amount),
          currency: data.currency,
          recipient_role: "client",
        },
      }),
    }),
    fetch(`${origin}/api/notify/email`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        template: "appointment_cancellation_refunded",
        data: {
          recipient_id: data.lawyer_id,
          case_title: data.case_title,
          amount: String(data.amount),
          currency: data.currency,
          recipient_role: "lawyer",
        },
      }),
    }),
  ])
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const body = await req.json().catch(() => ({}))
  const appointmentId = body?.appointment_id as string | undefined
  const paymentId = body?.payment_id as string | undefined

  if (!appointmentId && !paymentId) {
    return NextResponse.json({ error: "appointment_id or payment_id is required" }, { status: 400 })
  }

  const admin = createAdminClient()

  let paymentRow: {
    id: string
    amount: number
    currency: string
    status: string
    stripe_payment_id: string | null
    case_id: string
    client_id: string
    lawyer_id: string
  } | null = null

  let appointmentRow: {
    id: string
    status: string
    case_id: string | null
    client_id: string
    lawyer_id: string
  } | null = null

  if (paymentId) {
    const { data, error } = await admin
      .from("payments")
      .select("id, amount, currency, status, stripe_payment_id, case_id, client_id, lawyer_id")
      .eq("id", paymentId)
      .maybeSingle()
    if (error || !data) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 })
    }
    paymentRow = {
      id: data.id,
      amount: Number(data.amount),
      currency: data.currency || "PKR",
      status: data.status,
      stripe_payment_id: data.stripe_payment_id,
      case_id: data.case_id,
      client_id: data.client_id,
      lawyer_id: data.lawyer_id,
    }
    const { data: apt } = await admin
      .from("appointments")
      .select("id, status, case_id, client_id, lawyer_id")
      .eq("case_id", data.case_id)
      .eq("status", "cancelled")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    appointmentRow = apt
  } else if (appointmentId) {
    const { data: apt, error: aptErr } = await admin
      .from("appointments")
      .select("id, status, case_id, client_id, lawyer_id")
      .eq("id", appointmentId)
      .maybeSingle()

    if (aptErr || !apt) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
    }
    appointmentRow = apt

    if (apt.status !== "cancelled") {
      return NextResponse.json(
        { error: "Refund is only available after cancellation has been approved" },
        { status: 400 },
      )
    }

    if (!apt.case_id) {
      return NextResponse.json({ error: "Appointment has no linked case" }, { status: 400 })
    }

    const payment = await fetchCompletedPaymentForCase(
      admin,
      apt.case_id,
      apt.client_id,
      apt.lawyer_id,
    )
    if (!payment) {
      return NextResponse.json({ error: "No completed payment found for this consultation" }, { status: 404 })
    }
    paymentRow = {
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      stripe_payment_id: payment.stripe_payment_id,
      case_id: apt.case_id,
      client_id: apt.client_id,
      lawyer_id: apt.lawyer_id,
    }
  }

  if (!paymentRow) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 })
  }

  if (paymentRow.status === "refunded") {
    return NextResponse.json({
      success: true,
      already_refunded: true,
      payment_id: paymentRow.id,
      status: "refunded",
    })
  }

  if (paymentRow.status !== "completed") {
    return NextResponse.json(
      { error: `Payment status is "${paymentRow.status}"; only completed payments can be refunded` },
      { status: 400 },
    )
  }

  if (!paymentRow.stripe_payment_id) {
    return NextResponse.json(
      {
        error:
          "No Stripe payment reference on file. Process the refund manually in Stripe Dashboard, then mark refunded in the database.",
      },
      { status: 400 },
    )
  }

  let stripeRefundId: string
  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentRow.stripe_payment_id,
      reason: "requested_by_customer",
    })
    stripeRefundId = refund.id
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Stripe refund failed"
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const { data: updatedPayment, error: updErr } = await admin
    .from("payments")
    .update({
      status: "refunded",
      updated_at: new Date().toISOString(),
    })
    .eq("id", paymentRow.id)
    .eq("status", "completed")
    .select("id")
    .maybeSingle()

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }
  if (!updatedPayment) {
    return NextResponse.json(
      { error: "Payment was already updated. Refresh and check status." },
      { status: 409 },
    )
  }

  const { data: caseData } = await admin
    .from("cases")
    .select("title")
    .eq("id", paymentRow.case_id)
    .maybeSingle()

  const caseTitle = caseData?.title || "Consultation"

  await admin.from("notifications").insert([
    {
      user_id: paymentRow.client_id,
      created_by: auth.user!.id,
      type: "payment_update",
      title: "Refund Issued",
      description: `Your payment of ${paymentRow.amount} ${paymentRow.currency} for "${caseTitle}" has been refunded to your original payment method.`,
      data: { payment_id: paymentRow.id, appointment_id: appointmentRow?.id, stripe_refund_id: stripeRefundId },
    },
    {
      user_id: paymentRow.lawyer_id,
      created_by: auth.user!.id,
      type: "payment_update",
      title: "Client Refund Processed",
      description: `The client's payment for "${caseTitle}" was refunded after the cancelled consultation.`,
      data: { payment_id: paymentRow.id, appointment_id: appointmentRow?.id, stripe_refund_id: stripeRefundId },
    },
  ])

  if (paymentRow.case_id) {
    await appendCaseTimelineEvent(admin, {
      caseId: paymentRow.case_id,
      actorId: auth.user.id,
      eventType: CaseTimelineEventType.CANCELLATION_REFUNDED,
      metadata: {
        payment_id: paymentRow.id,
        appointment_id: appointmentRow?.id,
        amount: paymentRow.amount,
        currency: paymentRow.currency,
        stripe_refund_id: stripeRefundId,
      },
    })
  }

  await sendRefundEmails(req, {
    client_id: paymentRow.client_id,
    lawyer_id: paymentRow.lawyer_id,
    case_title: caseTitle,
    amount: paymentRow.amount,
    currency: paymentRow.currency,
  })

  return NextResponse.json({
    success: true,
    payment_id: paymentRow.id,
    status: "refunded",
    stripe_refund_id: stripeRefundId,
    amount: paymentRow.amount,
    currency: paymentRow.currency,
  })
}
