"use client"

import { cn } from "@/lib/utils"
import {
  formatCaseTimelineEventLabel,
  caseTimelineEventDetail,
  CaseTimelineEventType,
} from "@/lib/case-timeline"
import {
  FileText,
  Send,
  CreditCard,
  Calendar,
  CheckCircle2,
  Briefcase,
  AlertTriangle,
  XCircle,
  Brain,
  Upload,
  Trophy,
  RefreshCw,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface TimelineEvent {
  id: string
  event_type: string
  created_at: string
  metadata: Record<string, unknown> | null
}

const EVENT_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  [CaseTimelineEventType.CASE_CREATED]: {
    icon: FileText,
    color: "bg-blue-500 text-white",
  },
  [CaseTimelineEventType.DOCUMENT_UPLOADED]: {
    icon: Upload,
    color: "bg-slate-500 text-white",
  },
  [CaseTimelineEventType.AI_ANALYSIS_COMPLETED]: {
    icon: Brain,
    color: "bg-violet-500 text-white",
  },
  [CaseTimelineEventType.LAWYER_SELECTED]: {
    icon: Briefcase,
    color: "bg-indigo-500 text-white",
  },
  [CaseTimelineEventType.CONSULTATION_REQUESTED]: {
    icon: Send,
    color: "bg-orange-500 text-white",
  },
  [CaseTimelineEventType.CONSULTATION_ACCEPTED]: {
    icon: CheckCircle2,
    color: "bg-emerald-500 text-white",
  },
  [CaseTimelineEventType.PAYMENT_COMPLETED]: {
    icon: CreditCard,
    color: "bg-green-600 text-white",
  },
  [CaseTimelineEventType.CASE_ACTIVATED]: {
    icon: Briefcase,
    color: "bg-blue-600 text-white",
  },
  [CaseTimelineEventType.CONSULTATION_ATTENDED]: {
    icon: CheckCircle2,
    color: "bg-emerald-600 text-white",
  },
  [CaseTimelineEventType.CONSULTATION_RESCHEDULED]: {
    icon: RefreshCw,
    color: "bg-amber-500 text-white",
  },
  [CaseTimelineEventType.APPOINTMENT_CANCELLED]: {
    icon: XCircle,
    color: "bg-red-500 text-white",
  },
  [CaseTimelineEventType.LAWYER_REJECTED_CONSULTATION]: {
    icon: XCircle,
    color: "bg-red-500 text-white",
  },
  [CaseTimelineEventType.LAWYER_CANCELLED_CONSULTATION]: {
    icon: XCircle,
    color: "bg-red-500 text-white",
  },
  [CaseTimelineEventType.DISPUTE_OPENED]: {
    icon: AlertTriangle,
    color: "bg-red-600 text-white",
  },
  [CaseTimelineEventType.CASE_COMPLETED]: {
    icon: Trophy,
    color: "bg-green-600 text-white",
  },
}

const DEFAULT_CONFIG = { icon: Calendar, color: "bg-muted-foreground text-white" }

interface CaseActivityFeedProps {
  events: TimelineEvent[]
  className?: string
}

export function CaseActivityFeed({ events, className }: CaseActivityFeedProps) {
  if (events.length === 0) {
    return (
      <div className={cn("rounded-lg border border-dashed p-6 text-center", className)}>
        <Calendar className="mx-auto h-8 w-8 text-muted-foreground/40" />
        <p className="mt-2 text-sm text-muted-foreground">
          No activity yet. Key steps will appear here as they happen.
        </p>
      </div>
    )
  }

  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )

  return (
    <div className={cn("space-y-0", className)}>
      {sortedEvents.map((ev, idx) => {
        const config = EVENT_CONFIG[ev.event_type] || DEFAULT_CONFIG
        const Icon = config.icon
        const detail = caseTimelineEventDetail(ev.event_type, ev.metadata)
        const isLast = idx === sortedEvents.length - 1

        return (
          <div key={ev.id} className="flex gap-3 group">
            {/* Connector line + icon */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0 shadow-sm",
                  config.color,
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              {!isLast && (
                <div className="w-px flex-1 bg-border min-h-[1rem]" />
              )}
            </div>

            {/* Content */}
            <div className={cn("pb-5 flex-1 min-w-0", isLast && "pb-0")}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-foreground leading-tight pt-1">
                  {formatCaseTimelineEventLabel(ev.event_type)}
                </p>
                <span
                  className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0 pt-1.5"
                  title={new Date(ev.created_at).toLocaleString()}
                >
                  {formatDistanceToNow(new Date(ev.created_at), { addSuffix: true })}
                </span>
              </div>
              {detail && (
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{detail}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
