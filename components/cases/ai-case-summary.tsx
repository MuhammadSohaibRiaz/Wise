"use client"

import { useState } from "react"
import { AlertCircle, CheckCircle2, ChevronRight, Sparkles, Wand2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type RiskLevel = "Low" | "Medium" | "High"

type AiCaseSummary = {
  overview: string
  current_status: string
  risk_level: RiskLevel
  risk_assessment: string
  key_findings: string[]
  consultation_summary: string
  recommended_next_steps: string[]
  overall_strength: number
  data_quality_note?: string
  generated_at: string
}

interface AiCaseSummaryProps {
  caseId: string
}

const RADIUS = 54
const STROKE = 10
const CIRCUMFERENCE = Math.PI * RADIUS

function getRiskClass(level: RiskLevel) {
  if (level === "High") return "border-red-200 bg-red-50 text-red-700"
  if (level === "Medium") return "border-amber-200 bg-amber-50 text-amber-700"
  return "border-green-200 bg-green-50 text-green-700"
}

function getStrengthConfig(score: number) {
  if (score >= 70) return { label: "Strong", color: "#22c55e", trackColor: "#dcfce7", textColor: "text-green-600" }
  if (score >= 40) return { label: "Moderate", color: "#f59e0b", trackColor: "#fef3c7", textColor: "text-amber-600" }
  return { label: "Needs Review", color: "#ef4444", trackColor: "#fee2e2", textColor: "text-red-600" }
}

function StrengthGauge({ score }: { score: number }) {
  const safeScore = Math.max(0, Math.min(100, Math.round(score || 0)))
  const config = getStrengthConfig(safeScore)
  const offset = CIRCUMFERENCE - (safeScore / 100) * CIRCUMFERENCE

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-[72px] w-[126px]">
        <svg viewBox="0 0 128 72" className="h-full w-full" aria-label={`Case strength: ${safeScore}%`}>
          <path
            d="M 10 66 A 54 54 0 0 1 118 66"
            fill="none"
            stroke={config.trackColor}
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
          <path
            d="M 10 66 A 54 54 0 0 1 118 66"
            fill="none"
            stroke={config.color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end">
          <span className={cn("text-2xl font-bold leading-none", config.textColor)}>{safeScore}%</span>
        </div>
      </div>
      <span className={cn("text-xs font-semibold", config.textColor)}>{config.label}</span>
    </div>
  )
}

function LoadingSummary() {
  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle>Generating AI Summary</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
        <div className="grid gap-3 md:grid-cols-3">
          <div className="h-20 animate-pulse rounded-lg bg-muted" />
          <div className="h-20 animate-pulse rounded-lg bg-muted" />
          <div className="h-20 animate-pulse rounded-lg bg-muted" />
        </div>
      </CardContent>
    </Card>
  )
}

export function AiCaseSummary({ caseId }: AiCaseSummaryProps) {
  const [summary, setSummary] = useState<AiCaseSummary | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateSummary = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/cases/${caseId}/summary`, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || "AI summary could not be generated.")
      }

      setSummary(payload as AiCaseSummary)
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI summary could not be generated.")
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return <LoadingSummary />
  }

  if (error) {
    return (
      <Card className="max-w-3xl border-red-200 bg-red-50/60">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div>
              <h3 className="font-semibold text-red-900">Summary unavailable</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
          <Button variant="outline" onClick={generateSummary}>
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!summary) {
    return (
      <Card className="max-w-3xl border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Case Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Generate a fresh summary from this case&apos;s details, documents, analyses, appointments, and activity timeline.
          </p>
          <Button onClick={generateSummary}>
            <Wand2 className="mr-2 h-4 w-4" />
            Generate AI Summary
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="border-2 border-primary/20">
        <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">AI Case Summary</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Generated {summary.generated_at ? new Date(summary.generated_at).toLocaleString() : "just now"}
            </p>
            <Button variant="outline" size="sm" onClick={generateSummary}>
              <Wand2 className="mr-2 h-4 w-4" />
              Regenerate
            </Button>
          </div>
          <StrengthGauge score={summary.overall_strength} />
        </CardContent>
      </Card>

      <Card className="border-blue-200 bg-blue-50/60">
        <CardHeader>
          <CardTitle className="text-base text-blue-950">Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-blue-950/80">{summary.overview}</p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current Status</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">{summary.current_status}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3 text-base">
              Risk Assessment
              <Badge variant="outline" className={getRiskClass(summary.risk_level)}>
                {summary.risk_level} Risk
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">{summary.risk_assessment}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Key Findings</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {summary.key_findings.map((finding, index) => (
                <li key={`${finding}-${index}`} className="flex gap-2 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                  <span>{finding}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Consultation Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">{summary.consultation_summary}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recommended Next Steps</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {summary.recommended_next_steps.map((step, index) => (
              <li key={`${step}-${index}`} className="flex gap-3 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <span className="flex-1">{step}</span>
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {summary.data_quality_note && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="p-4">
            <p className="text-sm text-amber-800">{summary.data_quality_note}</p>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        This summary is AI-generated based on available case data. It is for informational purposes only and does not constitute legal advice.
      </p>
    </div>
  )
}
