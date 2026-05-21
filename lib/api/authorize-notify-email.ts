import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"

type EmailTemplate =
  | "case_completion_request"
  | "appointment_accepted"
  | "payment_confirmed"
  | "verification_approved"
  | "verification_rejected"
  | "appointment_rescheduled"
  | "appointment_cancelled"
  | "appointment_cancellation_resolved"

export async function authorizeNotifyEmailRequest(
  user: User,
  template: EmailTemplate,
  data: Record<string, string>,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_type")
    .eq("id", user.id)
    .maybeSingle()

  const userType = profile?.user_type
  const isAdmin = userType === "admin"

  if (isAdmin) {
    return { ok: true }
  }

  switch (template) {
    case "verification_approved":
    case "verification_rejected":
    case "appointment_cancellation_resolved":
      return { ok: false, status: 403, error: "Forbidden" }

    case "case_completion_request": {
      const { lawyer_id, case_id, client_id } = data
      if (user.id !== lawyer_id) {
        return { ok: false, status: 403, error: "Forbidden" }
      }
      if (case_id) {
        const { data: caseRow } = await supabase
          .from("cases")
          .select("client_id, lawyer_id")
          .eq("id", case_id)
          .maybeSingle()
        if (!caseRow || caseRow.lawyer_id !== user.id) {
          return { ok: false, status: 403, error: "Forbidden" }
        }
        if (client_id && caseRow.client_id !== client_id) {
          return { ok: false, status: 403, error: "Forbidden" }
        }
      }
      return { ok: true }
    }

    case "appointment_accepted": {
      if (user.id !== data.lawyer_id) {
        return { ok: false, status: 403, error: "Forbidden" }
      }
      return { ok: true }
    }

    case "payment_confirmed": {
      if (user.id === data.client_id) {
        return { ok: true }
      }
      return { ok: false, status: 403, error: "Forbidden" }
    }

    case "appointment_rescheduled":
    case "appointment_cancelled": {
      const allowedIds = [data.client_id, data.lawyer_id, data.recipient_id].filter(Boolean)
      if (!allowedIds.includes(user.id)) {
        return { ok: false, status: 403, error: "Forbidden" }
      }
      return { ok: true }
    }

    default:
      return { ok: false, status: 400, error: "Unknown template" }
  }
}
