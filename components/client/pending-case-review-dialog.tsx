"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Star, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { recomputeLawyerRatingStats } from "@/lib/recompute-lawyer-stats"
import { cn } from "@/lib/utils"

export interface PendingReviewCase {
  id: string
  title: string
  lawyerId: string
  lawyerName: string
}

interface PendingCaseReviewDialogProps {
  pending: PendingReviewCase | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmitted: () => void
}

export function PendingCaseReviewDialog({
  pending,
  open,
  onOpenChange,
  onSubmitted,
}: PendingCaseReviewDialogProps) {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!pending || rating < 1) return
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not signed in")

      const { error: insErr } = await supabase.from("reviews").insert({
        case_id: pending.id,
        reviewer_id: user.id,
        reviewee_id: pending.lawyerId,
        rating,
        comment: comment.trim() || null,
        status: "published",
      })
      if (insErr) throw insErr

      await recomputeLawyerRatingStats(supabase, pending.lawyerId)
      setRating(0)
      setComment("")
      onSubmitted()
      onOpenChange(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not save review")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>How was your experience?</DialogTitle>
          <DialogDescription>
            {pending ? (
              <>
                Your case <span className="font-medium text-foreground">{pending.title}</span> is marked complete.
                Rate <span className="font-medium text-foreground">{pending.lawyerName}</span> — your feedback updates
                their public profile in real time.
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="mb-2 block">Rating</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={cn(
                    "p-1 rounded transition-colors",
                    (hover || rating) >= n ? "text-amber-400" : "text-muted-foreground/40",
                  )}
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => setRating(n)}
                  aria-label={`${n} stars`}
                >
                  <Star className={cn("h-8 w-8", (hover || rating) >= n && "fill-current")} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="review-comment">Comment (optional)</Label>
            <textarea
              id="review-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share what went well or what could improve..."
              rows={3}
              className="mt-1 flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Later
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={saving || rating < 1}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
