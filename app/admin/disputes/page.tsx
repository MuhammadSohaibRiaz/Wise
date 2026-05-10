"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, AlertTriangle, CheckCircle, Clock, User, Briefcase, MessageSquare } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { AdminHeader } from "@/components/admin/admin-header"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

interface Dispute {
  id: string
  case_id: string
  reason: string
  description: string
  status: string
  created_at: string
  raised_by_profile: {
    first_name: string
    last_name: string
    email: string
  }
  case: {
    title: string
    lawyer: {
      first_name: string
      last_name: string
    }
  }
}

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null)
  const [adminNotes, setAdminNotes] = useState("")
  const [isResolving, setIsResolving] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()

  const fetchDisputes = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from("case_disputes")
        .select(`
          *,
          raised_by_profile:profiles!raised_by (first_name, last_name, email),
          case:cases (
            title,
            lawyer:profiles!lawyer_id (first_name, last_name)
          )
        `)
        .order("created_at", { ascending: false })

      if (error) throw error
      setDisputes(data || [])
    } catch (error) {
      console.error("Fetch disputes error:", error)
      toast({
        title: "Error",
        description: "Failed to load disputes.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDisputes()
  }, [])

  const handleResolve = async () => {
    if (!selectedDispute) return

    try {
      setIsResolving(true)
      const { error } = await supabase
        .from("case_disputes")
        .update({
          status: "resolved",
          admin_notes: adminNotes,
          resolved_at: new Date().toISOString()
        })
        .eq("id", selectedDispute.id)

      if (error) throw error

      // Also update case status to 'closed' or back to 'in_progress'?
      // For now, let's just resolve the dispute.
      
      toast({
        title: "Dispute Resolved",
        description: "The dispute has been marked as resolved.",
      })
      
      setSelectedDispute(null)
      setAdminNotes("")
      fetchDisputes()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to resolve dispute.",
        variant: "destructive",
      })
    } finally {
      setIsResolving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50/50">
        <AdminHeader />
        <div className="flex items-center justify-center h-[calc(100-64px)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20">
      <AdminHeader />
      
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Case Disputes</h1>
          <p className="text-gray-500 mt-1">Review and mediate conflicts between clients and lawyers</p>
        </div>

        {disputes.length === 0 ? (
          <Card className="border-dashed border-2 py-20 text-center bg-white">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold">No Active Disputes</h2>
            <p className="text-muted-foreground mt-1">Everything is running smoothly.</p>
          </Card>
        ) : (
          <div className="grid gap-6">
            {disputes.map((dispute) => (
              <Card key={dispute.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <CardHeader className="bg-white border-b pb-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-50 rounded-lg">
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{dispute.case.title}</CardTitle>
                        <CardDescription>
                          Raised by {dispute.raised_by_profile.first_name} {dispute.raised_by_profile.last_name} on {new Date(dispute.created_at).toLocaleDateString()}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant={dispute.status === 'open' ? 'destructive' : dispute.status === 'resolved' ? 'default' : 'secondary'}>
                      {dispute.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-6 grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Reason</h4>
                      <p className="text-sm font-semibold text-red-600">{dispute.reason.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Description</h4>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{dispute.description}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4 border-t md:border-t-0 md:border-l md:pl-8 pt-4 md:pt-0">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Briefcase className="h-4 w-4" />
                      <span>Lawyer: <b>{dispute.case.lawyer.first_name} {dispute.case.lawyer.last_name}</b></span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span>Client: <b>{dispute.raised_by_profile.first_name} {dispute.raised_by_profile.last_name}</b></span>
                    </div>
                    
                    {dispute.status === 'open' ? (
                      <Button className="w-full mt-4" onClick={() => setSelectedDispute(dispute)}>
                        Take Action
                      </Button>
                    ) : (
                      <div className="bg-muted/30 p-4 rounded-lg mt-4 border border-dashed">
                        <p className="text-xs font-bold uppercase mb-2">Resolution Note</p>
                        <p className="text-sm text-muted-foreground italic">
                          "{(dispute as any).admin_notes || 'No notes provided.'}"
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Resolution Dialog */}
      <Dialog open={!!selectedDispute} onOpenChange={(open) => !open && setSelectedDispute(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Resolve Dispute</DialogTitle>
            <DialogDescription>
              Provide a summary of the resolution. This will be visible to both parties.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="p-4 bg-muted rounded-lg text-sm italic">
              " {selectedDispute?.description} "
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Admin Resolution Notes</label>
              <Textarea 
                placeholder="e.g. After reviewing the case documents, we have instructed the lawyer to complete the pending filings..."
                rows={5}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedDispute(null)}>Cancel</Button>
            <Button onClick={handleResolve} disabled={isResolving || !adminNotes}>
              {isResolving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm Resolution
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
