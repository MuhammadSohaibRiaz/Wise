"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { AdminCancellationRequest } from "@/lib/admin/cancellation-queues"
import {
  dispatchAdminCancellationRefresh,
  useAdminCancellationSync,
} from "@/lib/hooks/use-admin-cancellation-sync"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Calendar,
  Clock,
  User,
  FileText,
  CreditCard,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { AdminHeader } from "@/components/admin/admin-header"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { formatCurrency } from "@/lib/currency"
import { REFUND_ARRIVAL_MESSAGE } from "@/lib/admin/cancellation-messages"

function CopyIdLine({ label, value }: { label: string; value: string }) {
  const { toast } = useToast()
  if (!value) return null
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between gap-x-2 py-1.5 border-b border-purple-100/80 last:border-0">
      <span className="text-[10px] font-bold text-purple-800/90 uppercase tracking-wider shrink-0">{label}</span>
      <div className="flex items-center gap-2 min-w-0">
        <code className="text-xs font-mono text-purple-950 break-all">{value}</code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-[10px] shrink-0 border-purple-200"
          onClick={() => {
            void navigator.clipboard.writeText(value)
            toast({ title: "Copied", description: `${label} copied to clipboard.` })
          }}
        >
          Copy
        </Button>
      </div>
    </div>
  )
}

type PaymentSummary = {
  id: string
  amount: number
  currency: string
  status: string
  stripe_payment_id: string | null
  payment_method: string | null
}

function RequestDetails({ request }: { request: AdminCancellationRequest }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Client</p>
          <div className="flex items-center gap-2 mt-1">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {request.client.first_name} {request.client.last_name}
            </span>
          </div>
          <p className="text-xs text-muted-foreground ml-6">{request.client.email}</p>
          {request.client.id && (
            <p className="text-[10px] text-muted-foreground ml-6 font-mono mt-0.5">
              Profile ID: {request.client.id}
            </p>
          )}
        </div>
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Lawyer</p>
          <div className="flex items-center gap-2 mt-1">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {request.lawyer.first_name} {request.lawyer.last_name}
            </span>
          </div>
          <p className="text-xs text-muted-foreground ml-6">{request.lawyer.email}</p>
          {request.lawyer.id && (
            <p className="text-[10px] text-muted-foreground ml-6 font-mono mt-0.5">
              Profile ID: {request.lawyer.id}
            </p>
          )}
        </div>
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Appointment</p>
          <p className="text-[10px] text-muted-foreground font-mono mt-0.5 break-all">{request.id}</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Case</p>
            <p className="text-sm font-medium">{request.case_title}</p>
            {request.case_type && <p className="text-xs text-muted-foreground">{request.case_type}</p>}
          </div>
        </div>
        {request.cancellation_request_message && (
          <div className="rounded-lg border bg-amber-50/50 p-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Request message</p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{request.cancellation_request_message}</p>
          </div>
        )}
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Scheduled</p>
              <p className="text-sm font-medium">{new Date(request.scheduled_at).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Time</p>
              <p className="text-sm font-medium">
                {new Date(request.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Reschedule Count</p>
          <p className="text-sm font-medium">{request.reschedule_count}/3</p>
        </div>
        {request.previous_status && (
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status Before Request</p>
            <Badge variant="outline" className="text-xs capitalize">
              {request.previous_status.replace(/_/g, " ")}
            </Badge>
          </div>
        )}
        {request.payment && (
          <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-purple-700" />
              <p className="text-[10px] font-bold text-purple-800 uppercase tracking-widest">Payment</p>
            </div>
            <p className="text-sm font-semibold text-purple-900">
              {formatCurrency(request.payment.amount)} {request.payment.currency} —{" "}
              <span className="capitalize">{request.payment.status}</span>
            </p>
            <div className="rounded-md border border-purple-200 bg-white/80 px-3 py-2">
              <p className="text-[10px] font-bold text-purple-900 uppercase tracking-widest mb-1">
                Stripe Dashboard lookup
              </p>
              <p className="text-xs text-purple-800/90 mb-2">
                In Stripe → Payments, search the <strong>Payment intent ID</strong> below (not the WiseCase payment UUID).
              </p>
              <CopyIdLine label="Payment intent (Stripe)" value={request.payment.stripe_payment_id || ""} />
              <CopyIdLine label="WiseCase payment ID" value={request.payment.id} />
              {!request.payment.stripe_payment_id && (
                <p className="text-xs text-amber-700 pt-1">No Stripe payment intent on file — refund manually in Stripe, then sync.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AdminCancellationRequestsPage() {
  const [requests, setRequests] = useState<AdminCancellationRequest[]>([])
  const [awaitingRefund, setAwaitingRefund] = useState<AdminCancellationRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [realtimeHint, setRealtimeHint] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<AdminCancellationRequest | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [refundTarget, setRefundTarget] = useState<AdminCancellationRequest | null>(null)
  const { toast } = useToast()
  const supabase = createClient()
  const router = useRouter()

  const fetchRequests = useCallback(
    async (opts?: { silent?: boolean }) => {
      try {
        if (opts?.silent) {
          setIsRefreshing(true)
        } else {
          setIsLoading(true)
        }
        const res = await fetch("/api/admin/cancellation-requests", { cache: "no-store" })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error || "Failed to load cancellation requests")

        setRequests(json.requests || [])
        setAwaitingRefund(json.awaiting_refund || [])
      } catch (error) {
        console.error("Fetch cancellation requests error:", error)
        if (!opts?.silent) {
          toast({ title: "Error", description: "Failed to load cancellation requests.", variant: "destructive" })
        }
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [toast],
  )

  useAdminCancellationSync({
    enabled: isAdmin,
    onSync: () => fetchRequests({ silent: true }),
    onRealtimeUnavailable: () => setRealtimeHint(true),
  })

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return

        const { data: profile } = await supabase
          .from("profiles")
          .select("user_type")
          .eq("id", user.id)
          .single()

        if (profile?.user_type === "admin") {
          setIsAdmin(true)
          void fetchRequests()
        } else {
          setIsAdmin(false)
          setIsLoading(false)
        }
      } catch (error) {
        console.error("Admin check error:", error)
        setIsLoading(false)
      }
    }
    void checkAdmin()
  }, [fetchRequests, supabase])

  const handleApprove = async (request: AdminCancellationRequest) => {
    try {
      setProcessingId(request.id)

      const res = await fetch("/api/admin/cancellation-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: request.id, action: "approved" }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Failed to approve cancellation")

      await fetchRequests({ silent: true })
      dispatchAdminCancellationRefresh()

      const refundHint = json.refund_eligible
        ? " Use Refund client below to return payment via Stripe."
        : ""
      toast({
        title: "Cancellation Approved",
        description: `Appointment cancelled and case closed.${refundHint}`,
      })
    } catch (error) {
      console.error("Approve error:", error)
      toast({ title: "Error", description: "Failed to approve cancellation.", variant: "destructive" })
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (request: AdminCancellationRequest) => {
    try {
      setProcessingId(request.id)

      const res = await fetch("/api/admin/cancellation-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: request.id, action: "rejected", reason: rejectReason || undefined }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Failed to reject cancellation")

      await fetchRequests({ silent: true })
      dispatchAdminCancellationRefresh()
      setRejectTarget(null)
      setRejectReason("")
      toast({
        title: "Cancellation Rejected",
        description: "The appointment remains scheduled. Both parties have been notified.",
      })
    } catch (error) {
      console.error("Reject error:", error)
      toast({ title: "Error", description: "Failed to reject cancellation.", variant: "destructive" })
    } finally {
      setProcessingId(null)
    }
  }

  const handleRefund = async (request: AdminCancellationRequest) => {
    try {
      setProcessingId(request.id)

      const res = await fetch("/api/admin/cancellation-requests/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointment_id: request.id, payment_id: request.payment?.id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Failed to issue refund")

      setRefundTarget(null)
      await fetchRequests({ silent: true })
      dispatchAdminCancellationRefresh()

      const synced = Boolean(json.synced_from_stripe)
      toast({
        title: json.already_refunded
          ? synced
            ? "Synced with Stripe"
            : "Already refunded"
          : "Refund issued",
        description: json.already_refunded
          ? synced
            ? `This payment was already refunded in Stripe. WiseCase is now updated. ${REFUND_ARRIVAL_MESSAGE}`
            : `This payment is already marked refunded in WiseCase. ${REFUND_ARRIVAL_MESSAGE}`
          : `Stripe refund created. ${REFUND_ARRIVAL_MESSAGE}`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to issue refund"
      toast({ title: "Refund failed", description: message, variant: "destructive" })
    } finally {
      setProcessingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50/50">
        <AdminHeader />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-gray-50">
        <XCircle className="h-16 w-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
        <p className="text-gray-600 mt-2">You do not have administrative privileges.</p>
        <Button className="mt-6" onClick={() => router.push("/auth/admin/sign-in")}>
          Return to Login
        </Button>
      </div>
    )
  }

  const hasWork = requests.length > 0 || awaitingRefund.length > 0

  return (
    <div className="min-h-screen bg-gray-50/50">
      <AdminHeader />

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Cancellation Requests</h1>
            <p className="text-gray-500 mt-1">
              Step 1: Approve or reject. Step 2: Refund paid consultations via Stripe (separate action).
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Updates automatically when clients, lawyers, or admins change appointment or payment status.
            </p>
            {realtimeHint && (
              <p className="text-xs text-amber-700 mt-2 max-w-lg">
                Live sync may be limited — run{" "}
                <code className="text-[11px] bg-amber-100 px-1 rounded">063_admin_appointments_payments_realtime.sql</code>{" "}
                in Supabase. The list still refreshes every ~45s and when you return to this tab.
              </p>
            )}
          </div>
          {isRefreshing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Syncing…
            </div>
          )}
        </div>

        {!hasWork ? (
          <Card className="border-dashed border-2 py-16 text-center bg-white">
            <div className="bg-green-50 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">All caught up</h2>
            <p className="text-gray-500 mt-1 max-w-md mx-auto">
              No pending cancellation requests and no approved cancellations awaiting refund.
            </p>
          </Card>
        ) : (
          <div className="space-y-10">
            {requests.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Pending review ({requests.length})
                </h2>
                {requests.map((request) => (
                  <Card
                    key={request.id}
                    className="overflow-hidden bg-white hover:shadow-md transition-shadow border-amber-200"
                  >
                    <CardContent className="p-6">
                      <div className="flex flex-wrap items-center gap-2 mb-4">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                          Cancellation Requested
                        </Badge>
                        {request.cancellation_requested_by ? (
                          <Badge variant="outline" className="border-amber-400 text-amber-800 capitalize">
                            Requested by {request.cancellation_requested_by}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-gray-300 text-gray-600">
                            Requester not recorded (legacy)
                          </Badge>
                        )}
                      </div>

                      <RequestDetails request={request} />

                      <div className="flex flex-wrap gap-3 mt-6 pt-4 border-t">
                        <Button
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handleApprove(request)}
                          disabled={processingId === request.id}
                        >
                          {processingId === request.id ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <CheckCircle className="h-4 w-4 mr-2" />
                          )}
                          Approve Cancellation
                        </Button>
                        <Button
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => {
                            setRejectTarget(request)
                            setRejectReason("")
                          }}
                          disabled={processingId === request.id}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </section>
            )}

            {awaitingRefund.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Awaiting refund ({awaitingRefund.length})
                </h2>
                <p className="text-sm text-muted-foreground -mt-2">
                  These cancellations were approved. Issue a full refund to the client&apos;s original card via
                  Stripe.
                </p>
                {awaitingRefund.map((request) => (
                  <Card key={request.id} className="overflow-hidden bg-white border-purple-200">
                    <CardContent className="p-6">
                      <div className="flex flex-wrap items-center gap-2 mb-4">
                        <CreditCard className="h-5 w-5 text-purple-600" />
                        <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                          Cancelled — refund due
                        </Badge>
                      </div>

                      <RequestDetails request={request} />

                      <div className="mt-6 pt-4 border-t">
                        <Button
                          className="bg-purple-700 hover:bg-purple-800 text-white"
                          onClick={() => setRefundTarget(request)}
                          disabled={processingId === request.id || !request.refund_eligible}
                        >
                          {processingId === request.id ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <CreditCard className="h-4 w-4 mr-2" />
                          )}
                          Refund client via Stripe
                        </Button>
                        {!request.refund_eligible && request.payment && (
                          <p className="text-xs text-amber-700 mt-2">
                            Stripe payment ID missing — refund manually in Stripe Dashboard, then set payment to
                            refunded in Supabase.
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </section>
            )}
          </div>
        )}
      </main>

      <Dialog
        open={!!rejectTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null)
            setRejectReason("")
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Cancellation Request</DialogTitle>
            <DialogDescription>
              The appointment will remain scheduled. Both parties will be notified.
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="text-sm font-medium mb-1 block">Reason (optional)</label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g., Appointment is within 24 hours..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={processingId === rejectTarget?.id}
              onClick={() => rejectTarget && handleReject(rejectTarget)}
            >
              {processingId === rejectTarget?.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Reject & Keep Scheduled
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!refundTarget}
        onOpenChange={(open) => {
          if (!open) setRefundTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Refund client via Stripe</DialogTitle>
            <DialogDescription>
              Issue a full refund to the client&apos;s original payment method for{" "}
              <strong>{refundTarget?.case_title}</strong>.
              {refundTarget?.payment ? (
                <>
                  {" "}
                  Amount: <strong>{formatCurrency(refundTarget.payment.amount)}</strong>.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This cannot be undone. The lawyer will be notified that the client payment was refunded.{" "}
            {REFUND_ARRIVAL_MESSAGE}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-purple-700 hover:bg-purple-800"
              disabled={processingId === refundTarget?.id}
              onClick={() => refundTarget && handleRefund(refundTarget)}
            >
              {processingId === refundTarget?.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
