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
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export type CaseOutcomeValue = "won" | "lost" | "settled" | "ongoing"

const OUTCOME_OPTIONS: { value: CaseOutcomeValue; label: string; description: string }[] = [
  {
    value: "won",
    label: "Case Won / Resolved in our favor",
    description: "The matter was resolved successfully for you.",
  },
  {
    value: "lost",
    label: "Case Lost / Ruled against us",
    description: "The outcome was not in your favor.",
  },
  {
    value: "settled",
    label: "Settled / Resolved mutually",
    description: "Both parties reached a mutual resolution.",
  },
  {
    value: "ongoing",
    label: "Ongoing / Still unresolved",
    description: "You are declining the lawyer's request to close this case as complete.",
  },
]

type CaseOutcomeDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (outcome: CaseOutcomeValue) => void
  isSubmitting?: boolean
}

export function CaseOutcomeDialog({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting = false,
}: CaseOutcomeDialogProps) {
  const [selected, setSelected] = useState<CaseOutcomeValue | null>(null)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setSelected(null)
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>How did the case conclude?</DialogTitle>
          <DialogDescription>
            Select an outcome before confirming completion. This helps your lawyer's success record on WiseCase.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          {OUTCOME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={isSubmitting}
              onClick={() => setSelected(opt.value)}
              className={cn(
                "w-full rounded-lg border p-3 text-left transition-colors",
                selected === opt.value
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:bg-muted/50",
              )}
            >
              <p className="text-sm font-medium">{opt.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={() => selected && onConfirm(selected)}
            disabled={!selected || isSubmitting}
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
