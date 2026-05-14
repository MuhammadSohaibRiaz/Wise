import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendEmail, buildEmailHtml } from "@/lib/email"
import { appendCaseTimelineEvent, CaseTimelineEventType } from "@/lib/case-timeline"

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@wisecaseapp.com"

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const appointmentId = body?.appointment_id as string | undefined
    const message = (body?.message as string | undefined)?.trim() || ""

    if (!appointmentId) {
      return NextResponse.json({ error: "appointment_id is required" }, { status: 400 })
    }

    if (message.length < 20) {
      return NextResponse.json({ error: "Message must be at least 20 characters" }, { status: 400 })
    }

    if (message.length > 2000) {
      return NextResponse.json({ error: "Message must not exceed 2000 characters" }, { status: 400 })
    }

    const { data: row, error: fetchErr } = await supabase
      .from("appointments")
      .select("id, client_id, lawyer_id, status, scheduled_at, duration_minutes, case_id, reschedule_count")
      .eq("id", appointmentId)
      .maybeSingle()

    if (fetchErr || !row) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
    }

    if (row.client_id !== user.id && row.lawyer_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (row.status !== "scheduled" && row.status !== "rescheduled") {
      return NextResponse.json(
        { error: "Support tickets for cancellation can only be submitted for paid appointments (scheduled or rescheduled)." },
        { status: 400 },
      )
    }

    const { error: updErr } = await supabase
      .from("appointments")
      .update({
        status: "cancellation_requested",
        previous_status: row.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", appointmentId)
      .in("status", ["scheduled", "rescheduled"])

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 400 })
    }

    // Fetch user profile for the support email
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("id", user.id)
      .single()

    const userName = userProfile
      ? `${userProfile.first_name || ""} ${userProfile.last_name || ""}`.trim()
      : "Unknown"
    const userEmail = userProfile?.email || user.email || "Unknown"

    // Fetch case title
    let caseTitle = ""
    if (row.case_id) {
      const { data: caseData } = await supabase
        .from("cases")
        .select("title")
        .eq("id", row.case_id)
        .single()
      caseTitle = caseData?.title || ""
    }

    // Timeline event
    if (row.case_id) {
      await appendCaseTimelineEvent(supabase, {
        caseId: row.case_id,
        actorId: user.id,
        eventType: CaseTimelineEventType.CANCELLATION_REQUESTED,
        metadata: {
          appointment_id: appointmentId,
          requested_by: user.id,
          message,
        },
      })
    }

    // Send email to support
    const scheduledAtFormatted = new Date(row.scheduled_at).toLocaleString("en-US", {
      dateStyle: "full",
      timeStyle: "short",
    })

    await sendEmail({
      to: SUPPORT_EMAIL,
      subject: `Support Request — Appointment ${appointmentId.slice(0, 8)}`,
      html: buildEmailHtml({
        title: "Appointment Cancellation Request",
        body: `
          <strong>User:</strong> ${userName} (${userEmail})<br>
          <strong>Appointment ID:</strong> ${appointmentId}<br>
          <strong>Case:</strong> ${caseTitle || "N/A"}<br>
          <strong>Scheduled Time:</strong> ${scheduledAtFormatted}<br>
          <strong>Reschedule Count:</strong> ${row.reschedule_count}/3<br>
          <strong>Duration:</strong> ${row.duration_minutes} minutes<br><br>
          <strong>User's Message:</strong><br>
          ${message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/\n/g, "<br>")}
        `.trim(),
        ctaText: "Review in Admin Panel",
        ctaUrl: `${(
          process.env.NEXT_PUBLIC_SITE_URL ||
          (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null) ||
          (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
          "http://localhost:3000"
        ).replace(/\/$/, "")}/admin/cancellation-requests`,
      }),
    })

    return NextResponse.json({
      success: true,
      message: "Your request has been submitted. We'll review and contact you within 24 hours.",
    })
  } catch (e: any) {
    console.error("[Support Ticket API] Error:", e)
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 })
  }
}
