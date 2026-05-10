"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Star, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface ReviewModalProps {
  isOpen: boolean
  onClose: () => void
  caseId: string
  lawyerId: string
  clientId: string
  onSuccess: () => void
}

export function ReviewModal({ isOpen, onClose, caseId, lawyerId, clientId, onSuccess }: ReviewModalProps) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({
        title: "Rating required",
        description: "Please select a rating from 1 to 5 stars.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSubmitting(true)

      const { error } = await supabase.from("reviews").insert({
        case_id: caseId,
        reviewer_id: clientId,
        reviewee_id: lawyerId,
        rating,
        comment,
        status: "pending", // Admin will approve it or it can be auto-published if you prefer
      })

      if (error) throw error

      toast({
        title: "Review submitted",
        description: "Thank you for your feedback! Your review has been submitted for moderation.",
      })
      
      onSuccess()
      onClose()
    } catch (error) {
      console.error("Error submitting review:", error)
      toast({
        title: "Error",
        description: "Failed to submit review. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Rate your Experience</DialogTitle>
          <DialogDescription>
            Share your feedback about the service provided by your lawyer.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className={`p-1 transition-colors ${
                  star <= rating ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground"
                }`}
              >
                <Star className="h-8 w-8" />
              </button>
            ))}
          </div>
          <Textarea
            placeholder="Tell us more about your experience (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="min-h-[100px]"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Skip
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
