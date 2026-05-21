"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
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

type PaymentSummary = {
  id: string
  amount: number
  currency: string
  status: string
  stripe_payment_id: string | null
  payment_method: string | null
}

interface CancellationRequest {
  id: string
  scheduled_at: string
  duration_minutes: number
  reschedule_count: number
  previous_status: string | null
  cancellation_requested_by?: "client" | "lawyer" | null
  cancellation_request_message?: string | null
  case_id: string
  case_title: string
  case_type: string
  payment?: PaymentSummary | null
  refund_eligible?: boolean
  client: {
    id: string
    first_name: string
    last_name: string
    email: string
  }
  lawyer: {
    id: string
    first_name: string
    last_name: string
    email: string
  }
}

function RequestDetails({ request }: { request: CancellationRequest }) {
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
          <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-3">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="h-4 w-4 text-purple-700" />
              <p className="text-[10px] font-bold text-purple-800 uppercase tracking-widest">Payment</p>
            </div>
            <p className="text-sm font-semibold text-purple-900">
              {formatCurrency(request.payment.amount)} {request.payment.currency} —{" "}
              <span className="capitalize">{request.payment.status}</span>
            </p>
            {request.payment.stripe_payment_id ? (
              <p className="text-xs text-purple-700/80 mt-1 font-mono truncate">
                Stripe: {request.payment.stripe_payment_id}
              </p>
            ) : (
              <p className="text-xs text-amber-700 mt-1">No Stripe ID — manual refund only</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function AdminCancellationRequestsPage() {
  const [requests, setRequests] = useState<CancellationRequest[]>([])
  const [awaitingRefund, setAwaitingRefund] = useState<CancellationRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<CancellationRequest | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [refundTarget, setRefundTarget] = useState<CancellationRequest | null>(null)
  const { toast } = useToast()
  const supabase = createClient()
  const router = useRouter()

  const fetchRequests = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await fetch("/api/admin/cancellation-requests", { cache: "no-store" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Failed to load cancellation requests")

      setRequests(json.requests || [])
      setAwaitingRefund(json.awaiting_refund || [])
    } catch (error) {
      console.error("Fetch cancellation requests error:", error)
      toast({ title: "Error", description: "Failed to load cancellation requests.", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

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

  const handleApprove = async (request: CancellationRequest) => {
    try {
      setProcessingId(request.id)

      const res = await fetch("/api/admin/cancellation-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: request.id, action: "approved" }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Failed to approve cancellation")

      await fetchRequests()

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

  const handleReject = async (request: CancellationRequest) => {
    try {
      setProcessingId(request.id)

      const res = await fetch("/api/admin/cancellation-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: request.id, action: "rejected", reason: rejectReason || undefined }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Failed to reject cancellation")

      setRequests((prev) => prev.filter((r) => r.id !== request.id))
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

  const handleRefund = async (request: CancellationRequest) => {
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
      await fetchRequests()

      toast({
        title: json.already_refunded ? "Already refunded" : "Refund Issued",
        description: json.already_refunded
          ? "This payment was already marked as refunded."
          : "Stripe refund created. Client will see funds on their original payment method.",
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Cancellation Requests</h1>
          <p className="text-gray-500 mt-1">
            Step 1: Approve or reject. Step 2: Refund paid consultations via Stripe (separate action).
          </p>
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
            This cannot be undone. The lawyer will be notified that the client payment was refunded.
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
