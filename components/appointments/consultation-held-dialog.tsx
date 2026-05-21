"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

type ConsultationHeldDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onProceed: () => void
  onCloseCase: () => void
  isSubmitting?: boolean
}

export function ConsultationHeldDialog({
  open,
  onOpenChange,
  onProceed,
  onCloseCase,
  isSubmitting = false,
}: ConsultationHeldDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Consultation Complete?</DialogTitle>
          <DialogDescription>
            Did you and the other party agree to proceed with this case?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={onProceed} disabled={isSubmitting} className="w-full">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Yes, proceed with case
          </Button>
          <Button variant="outline" onClick={onCloseCase} disabled={isSubmitting} className="w-full">
            No, close the case
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
