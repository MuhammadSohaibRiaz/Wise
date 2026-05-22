export type PaymentWithAppointmentStatus = {
  id: string
  amount: number
  status: string
  appointment_id: string | null
  appointment?: { id: string; status: string } | { id: string; status: string }[] | null
}

export function normalizePaymentAppointment(
  raw: PaymentWithAppointmentStatus["appointment"],
): { id: string; status: string } | null {
  if (!raw) return null
  const row = Array.isArray(raw) ? raw[0] : raw
  if (!row || typeof row !== "object") return null
  return {
    id: String(row.id ?? ""),
    status: String(row.status ?? ""),
  }
}

export function getPayablePendingPaymentIds(payments: PaymentWithAppointmentStatus[]): Set<string> {
  const payableIds = new Set<string>()
  const seenAwaitingAppointmentIds = new Set<string>()

  for (const payment of payments) {
    const appointment = normalizePaymentAppointment(payment.appointment)
    if (
      payment.status !== "pending" ||
      !payment.appointment_id ||
      appointment?.status !== "awaiting_payment"
    ) {
      continue
    }

    if (seenAwaitingAppointmentIds.has(payment.appointment_id)) continue
    seenAwaitingAppointmentIds.add(payment.appointment_id)
    payableIds.add(payment.id)
  }

  return payableIds
}

export function sumPayablePendingPayments(payments: PaymentWithAppointmentStatus[]): number {
  const payableIds = getPayablePendingPaymentIds(payments)
  return payments
    .filter((payment) => payableIds.has(payment.id))
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
}
