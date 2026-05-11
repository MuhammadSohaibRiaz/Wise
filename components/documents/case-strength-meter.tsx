"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface CaseStrengthMeterProps {
  riskLevel: "Low" | "Medium" | "High"
  urgency: "Normal" | "Urgent" | "Immediate"
  seriousness: "Low" | "Moderate" | "Critical"
}

const RISK_SCORES: Record<string, number> = { Low: 70, Medium: 45, High: 20 }
const URGENCY_SCORES: Record<string, number> = { Normal: 15, Urgent: 10, Immediate: 5 }
const SERIOUSNESS_SCORES: Record<string, number> = { Low: 15, Moderate: 10, Critical: 5 }

function computeScore(risk: string, urgency: string, seriousness: string) {
  return (RISK_SCORES[risk] ?? 45) + (URGENCY_SCORES[urgency] ?? 10) + (SERIOUSNESS_SCORES[seriousness] ?? 10)
}

function getScoreConfig(score: number) {
  if (score >= 70) return { label: "Strong Case", color: "#22c55e", trackColor: "#dcfce7", textColor: "text-green-600" }
  if (score >= 40) return { label: "Moderate Case", color: "#f59e0b", trackColor: "#fef3c7", textColor: "text-amber-600" }
  return { label: "Needs Attention", color: "#ef4444", trackColor: "#fee2e2", textColor: "text-red-600" }
}

const RADIUS = 54
const STROKE = 10
const CIRCUMFERENCE = Math.PI * RADIUS

export function CaseStrengthMeter({ riskLevel, urgency, seriousness }: CaseStrengthMeterProps) {
  const score = computeScore(riskLevel, urgency, seriousness)
  const config = getScoreConfig(score)
  const [animatedOffset, setAnimatedOffset] = useState(CIRCUMFERENCE)

  useEffect(() => {
    const target = CIRCUMFERENCE - (score / 100) * CIRCUMFERENCE
    const frame = requestAnimationFrame(() => setAnimatedOffset(target))
    return () => cancelAnimationFrame(frame)
  }, [score])

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-[140px] h-[80px]">
        <svg
          viewBox="0 0 128 72"
          className="w-full h-full"
          aria-label={`Case strength: ${score}%`}
        >
          {/* Track */}
          <path
            d="M 10 66 A 54 54 0 0 1 118 66"
            fill="none"
            stroke={config.trackColor}
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
          {/* Filled arc */}
          <path
            d="M 10 66 A 54 54 0 0 1 118 66"
            fill="none"
            stroke={config.color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={animatedOffset}
            className="transition-[stroke-dashoffset] duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-0">
          <span className={cn("text-2xl font-bold leading-none", config.textColor)}>
            {score}%
          </span>
        </div>
      </div>
      <span className={cn("text-sm font-semibold", config.textColor)}>
        {config.label}
      </span>
    </div>
  )
}
