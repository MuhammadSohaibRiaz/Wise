"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Loader2, AlertTriangle } from "lucide-react"

interface DisputeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  caseId: string
  onSuccess: () => void
}

export function DisputeModal({ open, onOpenChange, caseId, onSuccess }: DisputeModalProps) {
  const [reason, setReason] = useState("")
  const [description, setDescription] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason || !description) return

    try {
      setIsSubmitting(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Authentication required")

      const { error } = await supabase
        .from("case_disputes")
        .insert({
          case_id: caseId,
          raised_by: user.id,
          reason,
          description,
          status: "open"
        })

      if (error) throw error

      // Disputes are tracked in `case_disputes` only; do not set cases.status to "disputed"
      // (keeps case workflow / DB constraints consistent; UI shows "Dispute open" from dispute rows).

      toast({
        title: "Dispute Raised Successfully",
        description: "An administrator will review your case shortly.",
      })
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to raise dispute.",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="mx-auto bg-red-100 p-3 rounded-full w-fit mb-4">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <DialogTitle className="text-center text-xl">Raise a Dispute</DialogTitle>
          <DialogDescription className="text-center">
            Tell us why you are disputing the completion of this case. An admin will mediate.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Dispute</Label>
            <select
              id="reason"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select a reason...</option>
              <option value="incomplete_work">Work is incomplete</option>
              <option value="poor_quality">Poor quality of service</option>
              <option value="overcharged">Inaccurate billing/overcharged</option>
              <option value="no_response">Lawyer is non-responsive</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Detailed Description</Label>
            <Textarea
              id="description"
              required
              placeholder="Please provide details to help our admins understand the situation..."
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={isSubmitting || !reason || !description}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit Dispute
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
