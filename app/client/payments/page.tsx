"use client"

import { useEffect, useState, useCallback } from "react"
import type { Metadata } from "next"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/currency"
import { Download, CreditCard, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { PaymentButton } from "@/components/payments/payment-button"
import { appointmentStatusLabel } from "@/lib/appointments-status"

interface Payment {
  id: string
  amount: number
  status: "pending" | "completed" | "failed" | "refunded"
  payment_method: string | null
  created_at: string
  appointment_id: string | null
  appointment: {
    id: string
    status: string
  } | null
  case: {
    id: string
    title: string
  } | null
  lawyer: {
    id: string
    first_name: string | null
    last_name: string | null
  } | null
}

function normalizeAppointmentRelation(raw: unknown): Payment["appointment"] {
  if (!raw) return null
  const row = Array.isArray(raw) ? raw[0] : raw
  if (!row || typeof row !== "object") return null
  const value = row as Record<string, unknown>
  return {
    id: String(value.id ?? ""),
    status: String(value.status ?? ""),
  }
}

const statusConfig: Record<Payment["status"], { label: string; className: string }> = {
  pending: {
    label: "Pending",
    className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  },
  completed: {
    label: "Completed",
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  },
  failed: {
    label: "Failed",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  },
  refunded: {
    label: "Refunded",
    className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  },
}

const inactivePendingStatusConfig = {
  label: "No payment due",
  className: "bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300",
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [stats, setStats] = useState({
    totalSpent: 0,
    pending: 0,
  })
  const { toast } = useToast()

  const fetchPayments = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const supabase = createClient()

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) {
        setError("You must be logged in to view payments")
        toast({
          title: "Authentication Required",
          description: "Please log in to view your payments",
          variant: "destructive",
        })
        return
      }

      setUserId(session.user.id)

      const { data, error: fetchError } = await supabase
        .from("payments")
        .select(`
          id,
          amount,
          status,
          payment_method,
          created_at,
          appointment_id,
          appointment:appointments!payments_appointment_id_fkey (
            id,
            status
          ),
          case:cases!payments_case_id_fkey (
            id,
            title
          ),
          lawyer:profiles!payments_lawyer_id_fkey (
            id,
            first_name,
            last_name
          )
        `)
        .eq("client_id", session.user.id)
        .order("created_at", { ascending: false })

      if (fetchError) {
        console.error("[Payments] Error fetching payments:", fetchError)
        throw fetchError
      }

      const fetchedPayments = ((data || []) as Payment[]).map((payment) => ({
        ...payment,
        appointment: normalizeAppointmentRelation(payment.appointment),
      }))
      setPayments(fetchedPayments)

      const payablePendingIds = getPayablePendingPaymentIds(fetchedPayments)

      const totalSpent = fetchedPayments
        .filter((p) => p.status === "completed")
        .reduce((sum, p) => sum + p.amount, 0)

      const pending = fetchedPayments
        .filter((p) => payablePendingIds.has(p.id))
        .reduce((sum, p) => sum + p.amount, 0)

      setStats({ totalSpent, pending })
    } catch (error) {
      console.error("Error fetching payments:", error)
      toast({
        title: "Error",
        description: "Failed to load payments",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchPayments()
  }, [fetchPayments])

  useEffect(() => {
    if (!userId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`payments-client-${userId}-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payments",
          filter: `client_id=eq.${userId}`,
        },
        () => {
          void fetchPayments()
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `client_id=eq.${userId}`,
        },
        () => {
          void fetchPayments()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, fetchPayments])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const downloadReceipt = (payment: Payment) => {
    const receiptPdf = buildReceiptPdf(payment)
    const blob = new Blob([receiptPdf], { type: "application/pdf" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `wisecase-receipt-${payment.id.slice(0, 8)}.pdf`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  const payablePendingIds = getPayablePendingPaymentIds(payments)

  return (
    <main className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Payments</h1>
        <p className="text-muted-foreground mt-2">Track your payments and transaction history</p>
      </div>

      {/* Summary Cards */}
      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalSpent)}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.pending)}</div>
            <p className="text-xs text-muted-foreground">Awaiting payment</p>
          </CardContent>
        </Card>
      </section>

      {/* Payment History */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Payment History</h2>

        {error ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CreditCard className="h-12 w-12 text-destructive mb-4" />
              <p className="text-lg font-medium text-destructive">Error Loading Payments</p>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <Button onClick={() => window.location.reload()} variant="outline">
                Try Again
              </Button>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : payments.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No payments yet</p>
              <p className="text-sm text-muted-foreground">Your payment history will appear here</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {payments.map((payment) => {
              const isPayablePending = payablePendingIds.has(payment.id)
              const statusInfo =
                payment.status === "pending" && !isPayablePending
                  ? inactivePendingStatusConfig
                  : statusConfig[payment.status] ?? statusConfig.pending
              const linkedAppointmentStatus = payment.appointment?.status

              return (
              <Card key={payment.id}>
                <CardContent className="flex items-center justify-between p-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold">
                        {payment.case?.title || "Payment"}
                      </h3>
                      <Badge className={statusInfo.className}>
                        {statusInfo.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{formatDate(payment.created_at)}</span>
                      {payment.lawyer && (
                        <span>
                          To: {payment.lawyer.first_name} {payment.lawyer.last_name}
                        </span>
                      )}
                      {payment.payment_method && (
                        <span className="capitalize">{payment.payment_method}</span>
                      )}
                      {payment.status === "pending" && linkedAppointmentStatus && !isPayablePending && (
                        <span>Appointment: {appointmentStatusLabel(linkedAppointmentStatus)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-lg font-bold">{formatCurrency(payment.amount)}</p>
                    </div>
                    {isPayablePending && payment.appointment_id && (
                        <PaymentButton
                          appointmentId={payment.appointment_id}
                          paymentId={payment.id}
                          amount={payment.amount}
                          size="sm"
                          returnTo="payments"
                          onPaymentSuccess={() => void fetchPayments()}
                        />
                      )}
                    {payment.status === "pending" && !isPayablePending && (
                      <p className="text-xs text-muted-foreground text-right">
                        No action required
                      </p>
                    )}
                    {payment.status === "completed" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => downloadReceipt(payment)}
                      >
                        <Download className="h-4 w-4" />
                        Receipt
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}

function getPayablePendingPaymentIds(payments: Payment[]): Set<string> {
  const payableIds = new Set<string>()
  const seenAwaitingAppointmentIds = new Set<string>()

  for (const payment of payments) {
    if (
      payment.status !== "pending" ||
      !payment.appointment_id ||
      payment.appointment?.status !== "awaiting_payment"
    ) {
      continue
    }

    if (seenAwaitingAppointmentIds.has(payment.appointment_id)) continue
    seenAwaitingAppointmentIds.add(payment.appointment_id)
    payableIds.add(payment.id)
  }

  return payableIds
}

function buildReceiptPdf(payment: Payment): Uint8Array {
  const lawyerName = payment.lawyer
    ? `${payment.lawyer.first_name || ""} ${payment.lawyer.last_name || ""}`.trim() || "Lawyer"
    : "Lawyer"
  const paidDate = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(payment.created_at))

  const lines = [
    ["Receipt ID", payment.id],
    ["Date", paidDate],
    ["Case", payment.case?.title || "Payment"],
    ["Lawyer", lawyerName],
    ["Payment method", payment.payment_method || "Card"],
    ["Status", "Completed"],
    ["Amount", formatCurrency(payment.amount)],
  ]

  const content = [
    "BT",
    "/F1 28 Tf",
    "72 760 Td",
    `(${escapePdfText("WiseCase")}) Tj`,
    "/F1 12 Tf",
    "0 -24 Td",
    `(${escapePdfText("Payment receipt")}) Tj`,
    "/F1 10 Tf",
    "360 22 Td",
    `(${escapePdfText("PAID")}) Tj`,
    "ET",
    "0.8 w",
    "72 710 m 540 710 l S",
    "BT",
    "/F1 12 Tf",
    ...lines.flatMap(([label, value], index) => {
      const y = 675 - index * 34
      return [
        `1 0 0 1 72 ${y} Tm`,
        `(${escapePdfText(label)}) Tj`,
        `1 0 0 1 260 ${y} Tm`,
        `(${escapePdfText(value)}) Tj`,
      ]
    }),
    "ET",
    "BT",
    "/F1 10 Tf",
    "72 170 Td",
    `(${escapePdfText("This receipt was generated from your WiseCase payment history.")}) Tj`,
    "ET",
  ].join("\n")

  return makePdf(content)
}

function escapePdfText(value: string): string {
  return value
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
}

function makePdf(pageContent: string): Uint8Array {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${pageContent.length} >>\nstream\n${pageContent}\nendstream`,
  ]

  let pdf = "%PDF-1.4\n"
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(pdf.length)
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xrefOffset = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += "0000000000 65535 f \n"
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`
  })
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

  return new TextEncoder().encode(pdf)
}
