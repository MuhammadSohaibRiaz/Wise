"use client"

import { cn } from "@/lib/utils"
import type { LifecycleStage, LifecycleStageKey } from "@/lib/case-lifecycle-stages"
import {
  FileText,
  Send,
  CreditCard,
  Calendar,
  CheckCircle2,
  Briefcase,
  Clock,
  Trophy,
} from "lucide-react"

const ICON_MAP: Record<LifecycleStageKey, React.ElementType> = {
  draft: FileText,
  consultation_requested: Send,
  payment: CreditCard,
  consultation_scheduled: Calendar,
  consultation_held: CheckCircle2,
  case_in_progress: Briefcase,
  pending_completion: Clock,
  completed: Trophy,
}

interface CaseProgressStepperProps {
  stages: LifecycleStage[]
  className?: string
}

export function CaseProgressStepper({ stages, className }: CaseProgressStepperProps) {
  const currentStage = stages.find((s) => s.status === "current")

  return (
    <div className={cn("space-y-4", className)}>
      {/* Horizontal stepper (desktop) */}
      <div className="hidden md:block overflow-x-auto">
        <div className="flex items-start min-w-max">
          {stages.map((stage, idx) => {
            const Icon = ICON_MAP[stage.key]
            const isLast = idx === stages.length - 1
            return (
              <div key={stage.key} className="flex items-start flex-1 min-w-0">
                <div className="flex flex-col items-center text-center flex-shrink-0 w-20">
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors",
                      stage.status === "done" &&
                        "border-green-500 bg-green-500 text-white",
                      stage.status === "current" &&
                        "border-primary bg-primary text-primary-foreground shadow-md ring-4 ring-primary/20",
                      stage.status === "upcoming" &&
                        "border-muted-foreground/30 bg-muted text-muted-foreground/50",
                    )}
                  >
                    {stage.status === "done" ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <span
                    className={cn(
                      "mt-2 text-[11px] font-medium leading-tight max-w-[5rem]",
                      stage.status === "done" && "text-green-700 dark:text-green-400",
                      stage.status === "current" && "text-primary font-semibold",
                      stage.status === "upcoming" && "text-muted-foreground/60",
                    )}
                  >
                    {stage.shortLabel}
                  </span>
                </div>
                {!isLast && (
                  <div className="flex-1 flex items-center pt-[18px] px-1 min-w-[1.5rem]">
                    <div
                      className={cn(
                        "h-0.5 w-full rounded-full",
                        stages[idx + 1]?.status === "done" || stages[idx + 1]?.status === "current"
                          ? "bg-green-500"
                          : "bg-muted-foreground/20",
                      )}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Vertical stepper (mobile) */}
      <div className="md:hidden space-y-0">
        {stages.map((stage, idx) => {
          const Icon = ICON_MAP[stage.key]
          const isLast = idx === stages.length - 1
          return (
            <div key={stage.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 flex-shrink-0",
                    stage.status === "done" && "border-green-500 bg-green-500 text-white",
                    stage.status === "current" &&
                      "border-primary bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/20",
                    stage.status === "upcoming" &&
                      "border-muted-foreground/25 bg-muted text-muted-foreground/40",
                  )}
                >
                  {stage.status === "done" ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <Icon className="h-3.5 w-3.5" />
                  )}
                </div>
                {!isLast && (
                  <div
                    className={cn(
                      "w-0.5 flex-1 min-h-[1.5rem]",
                      stages[idx + 1]?.status === "done" || stages[idx + 1]?.status === "current"
                        ? "bg-green-500"
                        : "bg-muted-foreground/20",
                    )}
                  />
                )}
              </div>
              <div className={cn("pb-4", isLast && "pb-0")}>
                <p
                  className={cn(
                    "text-sm font-medium leading-none pt-1.5",
                    stage.status === "done" && "text-green-700 dark:text-green-400",
                    stage.status === "current" && "text-primary font-semibold",
                    stage.status === "upcoming" && "text-muted-foreground/50",
                  )}
                >
                  {stage.label}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Next action hint */}
      {currentStage?.nextAction && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
          <p className="text-sm">
            <span className="font-semibold text-primary">Next: </span>
            <span className="text-muted-foreground">{currentStage.nextAction}</span>
          </p>
        </div>
      )}
    </div>
  )
}
