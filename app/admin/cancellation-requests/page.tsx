"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle, XCircle, AlertTriangle, Calendar, Clock, User, FileText } from "lucide-react"
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

interface CancellationRequest {
  id: string
  scheduled_at: string
  duration_minutes: number
  reschedule_count: number
  case_id: string
  case_title: string
  case_type: string
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

export default function AdminCancellationRequestsPage() {
  const [requests, setRequests] = useState<CancellationRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<CancellationRequest | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const { toast } = useToast()
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    checkAdmin()
  }, [])

  const checkAdmin = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .single()

      if (profile?.user_type === "admin") {
        setIsAdmin(true)
        fetchRequests()
      } else {
        setIsAdmin(false)
        setIsLoading(false)
      }
    } catch (error) {
      console.error("Admin check error:", error)
      setIsLoading(false)
    }
  }

  const fetchRequests = async () => {
    try {
      setIsLoading(true)

      const { data, error } = await supabase
        .from("appointments")
        .select(`
          id,
          scheduled_at,
          duration_minutes,
          reschedule_count,
          case_id,
          cases (
            id,
            title,
            case_type
          ),
          client:profiles!appointments_client_id_fkey (
            id,
            first_name,
            last_name,
            email
          ),
          lawyer:profiles!appointments_lawyer_id_fkey (
            id,
            first_name,
            last_name,
            email
          )
        `)
        .eq("status", "cancellation_requested")
        .order("updated_at", { ascending: false })

      if (error) throw error

      const mapped: CancellationRequest[] = (data || []).map((apt: any) => ({
        id: apt.id,
        scheduled_at: apt.scheduled_at,
        duration_minutes: apt.duration_minutes,
        reschedule_count: apt.reschedule_count || 0,
        case_id: apt.cases?.id || apt.case_id || "",
        case_title: apt.cases?.title || "Unknown",
        case_type: apt.cases?.case_type || "",
        client: apt.client || { id: "", first_name: "Unknown", last_name: "", email: "" },
        lawyer: apt.lawyer || { id: "", first_name: "Unknown", last_name: "", email: "" },
      }))

      setRequests(mapped)
    } catch (error) {
      console.error("Fetch cancellation requests error:", error)
      toast({ title: "Error", description: "Failed to load cancellation requests.", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const handleApprove = async (request: CancellationRequest) => {
    try {
      setProcessingId(request.id)

      const { error } = await supabase
        .from("appointments")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", request.id)
        .eq("status", "cancellation_requested")

      if (error) throw error

      // Notify both parties via email
      const emailPromises = [
        fetch("/api/notify/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            template: "appointment_cancellation_resolved",
            data: {
              recipient_id: request.client.id,
              case_title: request.case_title,
              resolution: "approved",
              recipient_role: "client",
            },
          }),
        }),
        fetch("/api/notify/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            template: "appointment_cancellation_resolved",
            data: {
              recipient_id: request.lawyer.id,
              case_title: request.case_title,
              resolution: "approved",
              recipient_role: "lawyer",
            },
          }),
        }),
      ]
      await Promise.allSettled(emailPromises)

      // In-app notifications
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from("notifications").insert([
        {
          user_id: request.client.id,
          created_by: user?.id || request.client.id,
          type: "appointment_update",
          title: "Cancellation Approved",
          description: `Your cancellation request for "${request.case_title}" has been approved.`,
          data: { appointment_id: request.id, status: "cancelled" },
        },
        {
          user_id: request.lawyer.id,
          created_by: user?.id || request.lawyer.id,
          type: "appointment_update",
          title: "Cancellation Approved",
          description: `The cancellation request for "${request.case_title}" has been approved.`,
          data: { appointment_id: request.id, status: "cancelled" },
        },
      ])

      setRequests((prev) => prev.filter((r) => r.id !== request.id))
      toast({ title: "Cancellation Approved", description: "Both parties have been notified." })
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

      const { error } = await supabase
        .from("appointments")
        .update({ status: "scheduled", updated_at: new Date().toISOString() })
        .eq("id", request.id)
        .eq("status", "cancellation_requested")

      if (error) throw error

      const emailPromises = [
        fetch("/api/notify/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            template: "appointment_cancellation_resolved",
            data: {
              recipient_id: request.client.id,
              case_title: request.case_title,
              resolution: "rejected",
              reason: rejectReason || undefined,
              recipient_role: "client",
            },
          }),
        }),
        fetch("/api/notify/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            template: "appointment_cancellation_resolved",
            data: {
              recipient_id: request.lawyer.id,
              case_title: request.case_title,
              resolution: "rejected",
              reason: rejectReason || undefined,
              recipient_role: "lawyer",
            },
          }),
        }),
      ]
      await Promise.allSettled(emailPromises)

      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from("notifications").insert([
        {
          user_id: request.client.id,
          created_by: user?.id || request.client.id,
          type: "appointment_update",
          title: "Cancellation Rejected",
          description: `Your cancellation request for "${request.case_title}" was rejected. Please attend your appointment as scheduled.${rejectReason ? ` Reason: ${rejectReason}` : ""}`,
          data: { appointment_id: request.id, status: "scheduled" },
        },
        {
          user_id: request.lawyer.id,
          created_by: user?.id || request.lawyer.id,
          type: "appointment_update",
          title: "Cancellation Rejected",
          description: `The cancellation request for "${request.case_title}" was rejected. The appointment remains scheduled.${rejectReason ? ` Reason: ${rejectReason}` : ""}`,
          data: { appointment_id: request.id, status: "scheduled" },
        },
      ])

      setRequests((prev) => prev.filter((r) => r.id !== request.id))
      setRejectTarget(null)
      setRejectReason("")
      toast({ title: "Cancellation Rejected", description: "The appointment remains scheduled. Both parties have been notified." })
    } catch (error) {
      console.error("Reject error:", error)
      toast({ title: "Error", description: "Failed to reject cancellation.", variant: "destructive" })
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

  return (
    <div className="min-h-screen bg-gray-50/50">
      <AdminHeader />

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Cancellation Requests</h1>
          <p className="text-gray-500 mt-1">Review and resolve appointment cancellation requests from clients and lawyers</p>
        </div>

        {requests.length === 0 ? (
          <Card className="border-dashed border-2 py-16 text-center bg-white">
            <div className="bg-green-50 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">No Pending Requests</h2>
            <p className="text-gray-500 mt-1 max-w-xs mx-auto">
              There are no cancellation requests waiting for review.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <Card key={request.id} className="overflow-hidden bg-white hover:shadow-md transition-shadow border-amber-200">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200">Cancellation Requested</Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Client info */}
                    <div className="space-y-3">
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Client</p>
                        <div className="flex items-center gap-2 mt-1">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{request.client.first_name} {request.client.last_name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground ml-6">{request.client.email}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Lawyer</p>
                        <div className="flex items-center gap-2 mt-1">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{request.lawyer.first_name} {request.lawyer.last_name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground ml-6">{request.lawyer.email}</p>
                      </div>
                    </div>

                    {/* Appointment info */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Case</p>
                          <p className="text-sm font-medium">{request.case_title}</p>
                          {request.case_type && <p className="text-xs text-muted-foreground">{request.case_type}</p>}
                        </div>
                      </div>
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
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6 pt-4 border-t">
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
                      onClick={() => { setRejectTarget(request); setRejectReason("") }}
                      disabled={processingId === request.id}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject Cancellation
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Reject dialog with optional reason */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => { if (!open) { setRejectTarget(null); setRejectReason("") } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Cancellation Request</DialogTitle>
            <DialogDescription>
              The appointment will remain scheduled. Both parties will be notified. You can optionally provide a reason.
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="text-sm font-medium mb-1 block">Reason (optional)</label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g., Appointment is within 24 hours, refund not applicable..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
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
    </div>
  )
}
