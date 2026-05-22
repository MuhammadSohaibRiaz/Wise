import { NextRequest, NextResponse } from "next/server"
import type { User } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { authorizeNotifyEmailRequest } from "@/lib/api/authorize-notify-email"
import { formatAppointmentDateTime } from "@/lib/datetime"
import { sendEmail, buildEmailHtml, escapeHtml } from "@/lib/email"

type EmailTemplate =
  | "case_completion_request"
  | "appointment_requested"
  | "appointment_accepted"
  | "appointment_rejected"
  | "payment_confirmed"
  | "verification_approved"
  | "verification_rejected"
  | "appointment_rescheduled"
  | "appointment_cancelled"
  | "appointment_cancellation_resolved"
  | "appointment_cancellation_refunded"

interface RequestBody {
  template: EmailTemplate
  data: Record<string, string>
}

export async function POST(req: NextRequest) {
  // Auth: accept CRON_SECRET (server-to-server) OR a valid Supabase session (client-side calls)
  const secret = req.headers.get("x-cron-secret")
  const hasValidSecret = secret && secret === process.env.CRON_SECRET

  let sessionUser: User | null = null
  if (!hasValidSecret) {
    const userSupabase = await createClient()
    const {
      data: { user },
    } = await userSupabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    sessionUser = user
  }

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { template, data } = body
  if (!template || !data) {
    return NextResponse.json({ error: "Missing template or data" }, { status: 400 })
  }

  if (sessionUser) {
    const authz = await authorizeNotifyEmailRequest(sessionUser, template, data)
    if (!authz.ok) {
      return NextResponse.json({ error: authz.error }, { status: authz.status })
    }
  }

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null) ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "http://localhost:3000"
  ).replace(/\/$/, "")

  try {
    const supabase = createAdminClient()
    const deliverEmail = async (params: Parameters<typeof sendEmail>[0]) => {
      const ok = await sendEmail(params)
      if (!ok) {
        throw new Error(`Failed to send email to ${params.to}`)
      }
    }

    // All user-provided template variables must be escaped before entering HTML.
    // The email body builder handles layout only; this route owns data safety.
    switch (template) {
      case "case_completion_request": {
        const { client_id, lawyer_id, case_title, case_id } = data
        if (!client_id) return NextResponse.json({ error: "Missing client_id" }, { status: 400 })

        const [clientRes, lawyerRes] = await Promise.all([
          supabase.from("profiles").select("email, first_name").eq("id", client_id).single(),
          lawyer_id
            ? supabase.from("profiles").select("first_name, last_name").eq("id", lawyer_id).single()
            : Promise.resolve({ data: null }),
        ])

        if (!clientRes.data?.email) {
          return NextResponse.json({ error: "Client email not found" }, { status: 404 })
        }

        const lawyerName = escapeHtml(
          lawyerRes.data
            ? `${lawyerRes.data.first_name || ""} ${lawyerRes.data.last_name || ""}`.trim() || "Your lawyer"
            : "Your lawyer",
        )
        const safeCaseTitle = escapeHtml(case_title || "your case")

        await deliverEmail({
          to: clientRes.data.email,
          subject: "Action Required: Your lawyer has requested case completion",
          html: buildEmailHtml({
            title: "Case Completion Requested",
            body: `${lawyerName} has requested to mark <strong>"${safeCaseTitle}"</strong> as complete. Please review the case details and confirm or decline this request.`,
            ctaText: "Review Case",
            ctaUrl: `${siteUrl}/client/cases/${case_id}`,
          }),
        })
        break
      }

      case "appointment_requested": {
        const { lawyer_id, client_id, case_title, scheduled_at } = data
        if (!lawyer_id) return NextResponse.json({ error: "Missing lawyer_id" }, { status: 400 })

        const [lawyerRes, clientRes] = await Promise.all([
          supabase.from("profiles").select("email, first_name").eq("id", lawyer_id).single(),
          client_id
            ? supabase.from("profiles").select("first_name, last_name").eq("id", client_id).single()
            : Promise.resolve({ data: null }),
        ])

        if (!lawyerRes.data?.email) {
          return NextResponse.json({ error: "Lawyer email not found" }, { status: 404 })
        }

        const clientName = escapeHtml(
          clientRes.data
            ? `${clientRes.data.first_name || ""} ${clientRes.data.last_name || ""}`.trim() || "A client"
            : "A client",
        )
        const safeCaseTitle = case_title ? escapeHtml(case_title) : ""
        const formattedTime = scheduled_at ? escapeHtml(formatAppointmentDateTime(scheduled_at) || scheduled_at) : "the selected time"

        await deliverEmail({
          to: lawyerRes.data.email,
          subject: "New appointment request",
          html: buildEmailHtml({
            title: "New Appointment Request",
            body: `${clientName} requested a consultation${safeCaseTitle ? ` for <strong>"${safeCaseTitle}"</strong>` : ""} at <strong>${formattedTime}</strong>. Please review and accept or decline the request from your appointments page.`,
            ctaText: "Review Request",
            ctaUrl: `${siteUrl}/lawyer/appointments`,
          }),
        })
        break
      }

      case "appointment_accepted": {
        const { client_id, lawyer_id, case_title } = data
        if (!client_id) return NextResponse.json({ error: "Missing client_id" }, { status: 400 })

        const [clientRes, lawyerRes] = await Promise.all([
          supabase.from("profiles").select("email, first_name").eq("id", client_id).single(),
          lawyer_id
            ? supabase.from("profiles").select("first_name, last_name").eq("id", lawyer_id).single()
            : Promise.resolve({ data: null }),
        ])

        if (!clientRes.data?.email) {
          return NextResponse.json({ error: "Client email not found" }, { status: 404 })
        }

        const lawyerName = escapeHtml(
          lawyerRes.data
            ? `${lawyerRes.data.first_name || ""} ${lawyerRes.data.last_name || ""}`.trim() || "Your lawyer"
            : "Your lawyer",
        )
        const safeCaseTitle = escapeHtml(case_title || "your case")

        await deliverEmail({
          to: clientRes.data.email,
          subject: "Your consultation request has been accepted",
          html: buildEmailHtml({
            title: "Appointment Accepted",
            body: `${lawyerName} has accepted your consultation request for <strong>"${safeCaseTitle}"</strong>. Please proceed to payment to confirm your appointment.`,
            ctaText: "View Appointment",
            ctaUrl: `${siteUrl}/client/appointments`,
          }),
        })
        break
      }

      case "appointment_rejected": {
        const { client_id, lawyer_id, case_title } = data
        if (!client_id) return NextResponse.json({ error: "Missing client_id" }, { status: 400 })

        const [clientRes, lawyerRes] = await Promise.all([
          supabase.from("profiles").select("email, first_name").eq("id", client_id).single(),
          lawyer_id
            ? supabase.from("profiles").select("first_name, last_name").eq("id", lawyer_id).single()
            : Promise.resolve({ data: null }),
        ])

        if (!clientRes.data?.email) {
          return NextResponse.json({ error: "Client email not found" }, { status: 404 })
        }

        const lawyerName = escapeHtml(
          lawyerRes.data
            ? `${lawyerRes.data.first_name || ""} ${lawyerRes.data.last_name || ""}`.trim() || "The lawyer"
            : "The lawyer",
        )
        const safeCaseTitle = case_title ? escapeHtml(case_title) : ""

        await deliverEmail({
          to: clientRes.data.email,
          subject: "Your consultation request was declined",
          html: buildEmailHtml({
            title: "Appointment Request Declined",
            body: `${lawyerName} declined your consultation request${safeCaseTitle ? ` for <strong>"${safeCaseTitle}"</strong>` : ""}. You can choose another lawyer and send a new request.`,
            ctaText: "Find Lawyers",
            ctaUrl: `${siteUrl}/match`,
          }),
        })
        break
      }

      case "payment_confirmed": {
        const { client_id, case_title } = data
        if (!client_id) return NextResponse.json({ error: "Missing client_id" }, { status: 400 })

        const { data: profile } = await supabase
          .from("profiles")
          .select("email, first_name")
          .eq("id", client_id)
          .single()

        if (!profile?.email) {
          return NextResponse.json({ error: "Client email not found" }, { status: 404 })
        }

        const safeCaseTitle = case_title ? escapeHtml(case_title) : ""

        await deliverEmail({
          to: profile.email,
          subject: "Payment Confirmed — Consultation Scheduled",
          html: buildEmailHtml({
            title: "Payment Confirmed",
            body: `Your payment${safeCaseTitle ? ` for <strong>"${safeCaseTitle}"</strong>` : ""} has been received and your consultation has been scheduled. You'll find the details in your appointments.`,
            ctaText: "View Appointments",
            ctaUrl: `${siteUrl}/client/appointments`,
          }),
        })
        break
      }

      case "verification_approved": {
        const { lawyer_id } = data
        if (!lawyer_id) return NextResponse.json({ error: "Missing lawyer_id" }, { status: 400 })

        const { data: profile } = await supabase
          .from("profiles")
          .select("email, first_name")
          .eq("id", lawyer_id)
          .single()

        if (!profile?.email) {
          return NextResponse.json({ error: "Lawyer email not found" }, { status: 404 })
        }

        const safeFirstName = profile.first_name ? escapeHtml(profile.first_name) : ""

        await deliverEmail({
          to: profile.email,
          subject: "Your WiseCase account has been verified",
          html: buildEmailHtml({
            title: "Verification Approved",
            body: `Congratulations${safeFirstName ? `, ${safeFirstName}` : ""}! Your bar license has been verified. You can now access all platform features and start accepting cases.`,
            ctaText: "Go to Dashboard",
            ctaUrl: `${siteUrl}/lawyer/dashboard`,
          }),
        })
        break
      }

      case "verification_rejected": {
        const { lawyer_id } = data
        if (!lawyer_id) return NextResponse.json({ error: "Missing lawyer_id" }, { status: 400 })

        const { data: profile } = await supabase
          .from("profiles")
          .select("email, first_name")
          .eq("id", lawyer_id)
          .single()

        if (!profile?.email) {
          return NextResponse.json({ error: "Lawyer email not found" }, { status: 404 })
        }

        await deliverEmail({
          to: profile.email,
          subject: "Action Required: License verification unsuccessful",
          html: buildEmailHtml({
            title: "Verification Unsuccessful",
            body: `Your bar license document could not be verified. Please re-upload a valid document from your dashboard to continue the verification process.`,
            ctaText: "Re-upload Document",
            ctaUrl: `${siteUrl}/lawyer/dashboard`,
          }),
        })
        break
      }

      case "appointment_rescheduled": {
        const { recipient_id, actor_name, case_title, new_time, recipient_role } = data
        if (!recipient_id) return NextResponse.json({ error: "Missing recipient_id" }, { status: 400 })

        const { data: profile } = await supabase
          .from("profiles")
          .select("email, first_name")
          .eq("id", recipient_id)
          .single()

        if (!profile?.email) {
          return NextResponse.json({ error: "Recipient email not found" }, { status: 404 })
        }

        const formattedTime = formatAppointmentDateTime(new_time) || "a new time"
        const appointmentsUrl = recipient_role === "lawyer" ? `${siteUrl}/lawyer/appointments` : `${siteUrl}/client/appointments`
        const safeActorName = escapeHtml(actor_name || "The other party")
        const safeCaseTitle = case_title ? escapeHtml(case_title) : ""

        await deliverEmail({
          to: profile.email,
          subject: "Your appointment has been rescheduled",
          html: buildEmailHtml({
            title: "Appointment Rescheduled",
            body: `${safeActorName} has rescheduled your consultation${safeCaseTitle ? ` for <strong>"${safeCaseTitle}"</strong>` : ""} to <strong>${formattedTime}</strong>. If this time doesn't work, you can reschedule from your appointments page.`,
            ctaText: "View Appointments",
            ctaUrl: appointmentsUrl,
          }),
        })
        break
      }

      case "appointment_cancelled": {
        const { recipient_id, actor_name, case_title, recipient_role } = data
        if (!recipient_id) return NextResponse.json({ error: "Missing recipient_id" }, { status: 400 })

        const { data: profile } = await supabase
          .from("profiles")
          .select("email, first_name")
          .eq("id", recipient_id)
          .single()

        if (!profile?.email) {
          return NextResponse.json({ error: "Recipient email not found" }, { status: 404 })
        }

        const appointmentsUrl = recipient_role === "lawyer" ? `${siteUrl}/lawyer/appointments` : `${siteUrl}/client/appointments`
        const safeActorName = escapeHtml(actor_name || "The other party")
        const safeCaseTitle = case_title ? escapeHtml(case_title) : ""

        await deliverEmail({
          to: profile.email,
          subject: "Appointment Cancelled",
          html: buildEmailHtml({
            title: "Appointment Cancelled",
            body: `${safeActorName} has cancelled the consultation appointment${safeCaseTitle ? ` for <strong>"${safeCaseTitle}"</strong>` : ""}. You can book a new appointment if needed.`,
            ctaText: "View Appointments",
            ctaUrl: appointmentsUrl,
          }),
        })
        break
      }

      case "appointment_cancellation_resolved": {
        const { recipient_id, case_title, resolution, reason, recipient_role, requested_by } = data
        if (!recipient_id) return NextResponse.json({ error: "Missing recipient_id" }, { status: 400 })

        const { data: profile } = await supabase
          .from("profiles")
          .select("email, first_name")
          .eq("id", recipient_id)
          .single()

        if (!profile?.email) {
          return NextResponse.json({ error: "Recipient email not found" }, { status: 404 })
        }

        const isApproved = resolution === "approved"
        const appointmentsUrl = recipient_role === "lawyer" ? `${siteUrl}/lawyer/appointments` : `${siteUrl}/client/appointments`
        const safeCaseTitle = case_title ? escapeHtml(case_title) : ""
        const safeReason = reason ? escapeHtml(reason) : ""

        const isLawyer = recipient_role === "lawyer"
        const requester = requested_by === "client" || requested_by === "lawyer" ? requested_by : null
        const isOwnRequest =
          (isLawyer && requester === "lawyer") || (!isLawyer && requester === "client")
        const requesterPhrase = requester
          ? requester === "client"
            ? "The client's cancellation request"
            : "The lawyer's cancellation request"
          : "A cancellation request"

        const approvedBody = isOwnRequest
          ? `Your cancellation request${safeCaseTitle ? ` for <strong>"${safeCaseTitle}"</strong>` : ""} has been approved by WiseCase admin. The appointment has been cancelled.${safeReason ? `<br><br><strong>Admin note:</strong> ${safeReason}` : ""}`
          : `${requesterPhrase}${safeCaseTitle ? ` for <strong>"${safeCaseTitle}"</strong>` : ""} has been approved by WiseCase admin. The appointment has been cancelled.${safeReason ? `<br><br><strong>Admin note:</strong> ${safeReason}` : ""}`
        const rejectedBody = isOwnRequest
          ? `Your cancellation request${safeCaseTitle ? ` for <strong>"${safeCaseTitle}"</strong>` : ""} was rejected by WiseCase admin. The appointment remains active.${safeReason ? `<br><br><strong>Admin note:</strong> ${safeReason}` : ""} Please attend your appointment as planned.`
          : `${requesterPhrase}${safeCaseTitle ? ` for <strong>"${safeCaseTitle}"</strong>` : ""} was rejected by WiseCase admin. The appointment remains active.${safeReason ? `<br><br><strong>Admin note:</strong> ${safeReason}` : ""}`

        await deliverEmail({
          to: profile.email,
          subject: isApproved ? "Cancellation Approved" : "Cancellation Rejected",
          html: buildEmailHtml({
            title: isApproved ? "Cancellation Approved" : "Cancellation Request Rejected",
            body: isApproved ? approvedBody : rejectedBody,
            ctaText: "View Appointments",
            ctaUrl: appointmentsUrl,
          }),
        })
        break
      }

      case "appointment_cancellation_refunded": {
        const { recipient_id, case_title, amount, currency, recipient_role } = data
        if (!recipient_id) return NextResponse.json({ error: "Missing recipient_id" }, { status: 400 })

        const { data: profile } = await supabase
          .from("profiles")
          .select("email, first_name")
          .eq("id", recipient_id)
          .single()

        if (!profile?.email) {
          return NextResponse.json({ error: "Recipient email not found" }, { status: 404 })
        }

        const appointmentsUrl =
          recipient_role === "lawyer" ? `${siteUrl}/lawyer/appointments` : `${siteUrl}/client/payments`
        const safeCaseTitle = case_title ? escapeHtml(case_title) : ""
        const safeAmount = amount ? escapeHtml(amount) : ""
        const safeCurrency = currency ? escapeHtml(currency) : "PKR"
        const isLawyer = recipient_role === "lawyer"

        const body = isLawyer
          ? `The client's payment${safeCaseTitle ? ` for <strong>"${safeCaseTitle}"</strong>` : ""} (${safeCurrency} ${safeAmount}) has been refunded to their original payment method after the cancelled consultation.`
          : `Your payment${safeCaseTitle ? ` for <strong>"${safeCaseTitle}"</strong>` : ""} of <strong>${safeCurrency} ${safeAmount}</strong> has been refunded to your original payment method. It may take a few business days to appear on your statement.`

        await deliverEmail({
          to: profile.email,
          subject: isLawyer ? "Client payment refunded" : "Your refund has been issued",
          html: buildEmailHtml({
            title: "Refund processed",
            body,
            ctaText: isLawyer ? "View Appointments" : "View Payments",
            ctaUrl: appointmentsUrl,
          }),
        })
        break
      }

      default:
        return NextResponse.json({ error: `Unknown template: ${template}` }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[Email API] Error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
