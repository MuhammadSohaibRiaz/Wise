import type { SupabaseClient } from "@supabase/supabase-js"

export type NotificationType =
  | "system"
  | "message"
  | "appointment_request"
  | "appointment_update"
  | "case_update"
  | "payment_update"

export interface NotificationPayload {
  user_id: string
  created_by?: string | null
  type: NotificationType
  title: string
  description?: string | null
  data?: Record<string, any> | null
}

async function resolveCreatedBy(supabase: SupabaseClient, explicit?: string | null) {
  if (explicit) return explicit
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function createNotification(
  supabase: SupabaseClient,
  payload: NotificationPayload,
): Promise<boolean> {
  try {
    const createdBy = await resolveCreatedBy(supabase, payload.created_by)

    const { error } = await supabase.from("notifications").insert({
      user_id: payload.user_id,
      created_by: createdBy ?? payload.user_id,
      type: payload.type,
      title: payload.title,
      description: payload.description ?? null,
      data: payload.data ?? {},
    })

    if (error) {
      console.error("[v0] Notification insert error:", error)
      return false
    }

    return true
  } catch (error) {
    console.error("[v0] Notification unexpected error:", error)
    return false
  }
}

type AppointmentUpdateTemplate =
  | "lawyer_accept"
  | "lawyer_reject"
  | "client_cancel"
  | "lawyer_cancel"
  | "lawyer_reschedule"

const appointmentCopy: Record<
  AppointmentUpdateTemplate,
  (ctx: { caseTitle?: string | null; scheduledAt?: string }) => { title: string; description?: string }
> = {
  lawyer_accept: ({ caseTitle, scheduledAt }) => ({
    title: "Lawyer accepted your request",
    description: `${caseTitle || "Consultation"} • ${scheduledAt ? new Date(scheduledAt).toLocaleString() : ""}`,
  }),
  lawyer_reject: ({ caseTitle }) => ({
    title: "Lawyer declined your request",
    description: caseTitle || "Your pending appointment was rejected.",
  }),
  client_cancel: ({ caseTitle, scheduledAt }) => ({
    title: "Client cancelled the appointment",
    description: `${caseTitle || "Consultation"} • ${scheduledAt ? new Date(scheduledAt).toLocaleString() : ""}`,
  }),
  lawyer_cancel: ({ caseTitle, scheduledAt }) => ({
    title: "Lawyer cancelled the appointment",
    description: `${caseTitle || "Consultation"} • ${scheduledAt ? new Date(scheduledAt).toLocaleString() : ""}`,
  }),
  lawyer_reschedule: ({ caseTitle, scheduledAt }) => ({
    title: "Lawyer rescheduled your appointment",
    description: `${caseTitle || "Consultation"} • New time: ${scheduledAt ? new Date(scheduledAt).toLocaleString() : ""}`,
  }),
}

export async function notifyAppointmentRequest(
  supabase: SupabaseClient,
  params: {
    lawyerId: string
    clientId: string
    caseTitle?: string
    scheduledAt?: string
    caseId: string
    appointmentId: string
  },
) {
  return createNotification(supabase, {
    user_id: params.lawyerId,
    created_by: params.clientId,
    type: "appointment_request",
    title: "New appointment request",
    description: `${params.caseTitle || "Consultation"} • ${params.scheduledAt ? new Date(params.scheduledAt).toLocaleString() : ""}`,
    data: {
      appointment_id: params.appointmentId,
      case_id: params.caseId,
      status: "pending",
    },
  })
}

export async function notifyAppointmentUpdate(
  supabase: SupabaseClient,
  template: AppointmentUpdateTemplate,
  params: {
    recipientId: string
    actorId: string
    caseTitle?: string
    scheduledAt?: string
    appointmentId: string
    caseId?: string
  },
) {
  const copy = appointmentCopy[template](params)
  return createNotification(supabase, {
    user_id: params.recipientId,
    created_by: params.actorId,
    type: "appointment_update",
    title: copy.title,
    description: copy.description,
    data: {
      appointment_id: params.appointmentId,
      case_id: params.caseId,
      status:
        template === "lawyer_accept"
          ? "awaiting_payment"
          : template === "client_cancel" || template === "lawyer_cancel"
            ? "cancelled"
            : template === "lawyer_reschedule"
              ? "rescheduled"
              : "rejected",
    },
  })
}

export async function notifyMessage(
  supabase: SupabaseClient,
  params: {
    recipientId: string
    senderId: string
    caseId: string
    caseTitle?: string
    contentPreview: string
  },
) {
  return createNotification(supabase, {
    user_id: params.recipientId,
    created_by: params.senderId,
    type: "message",
    title: `New message${params.caseTitle ? ` in ${params.caseTitle}` : ""}`,
    description: params.contentPreview,
    data: {
      case_id: params.caseId,
    },
  })
}

export async function notifySystemEvent(
  supabase: SupabaseClient,
  params: {
    recipientId: string
    title: string
    description?: string
    data?: Record<string, any>
  },
) {
  return createNotification(supabase, {
    user_id: params.recipientId,
    created_by: params.recipientId,
    type: "system",
    title: params.title,
    description: params.description,
    data: params.data ?? {},
  })
}

export async function notifyAnalysisComplete(
  supabase: SupabaseClient,
  params: {
    userId: string
    documentId: string
    documentName: string
    riskLevel: string
  },
) {
  const safeDocumentName =
    typeof params.documentName === "string" && params.documentName.trim().length > 0
      ? params.documentName
      : "Document"
  const safeRiskLevel =
    typeof params.riskLevel === "string" && params.riskLevel.trim().length > 0 ? params.riskLevel : "Unknown"

  return createNotification(supabase, {
    user_id: params.userId,
    type: "case_update",
    title: "Analysis Complete",
    description: `Analysis for "${safeDocumentName}" is ready. Risk Level: ${safeRiskLevel}`,
    data: {
      document_id: params.documentId,
      action: "view_analysis",
    },
  })
}
