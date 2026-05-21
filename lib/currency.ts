export const APP_CURRENCY = "PKR"
export const APP_CURRENCY_CODE = "pkr"

export function formatCurrency(amount: number | null | undefined, options?: { maximumFractionDigits?: number }) {
  const value = Number(amount || 0)
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: APP_CURRENCY,
    maximumFractionDigits: options?.maximumFractionDigits ?? 0,
  }).format(value)
}

export function formatHourlyRate(amount: number | null | undefined) {
  return `${formatCurrency(amount)} / consultation`
}

export function formatConsultationFeeBase(amount: number | null | undefined) {
  return `${formatCurrency(amount)} / consultation (60 min)`
}

export function formatConsultationFeeFrom(amount: number | null | undefined) {
  return `from ${formatCurrency(amount)} / consultation`
}
