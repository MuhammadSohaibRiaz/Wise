"use client"

import { JudgeSimulationView } from "@/components/ai/judge-simulation-view"

export default function LawyerJudgeSimulationPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">Case Strategy Simulation</h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Stress-test arguments using an AI judicial perspective (Pakistan law framing). Educational only — not a substitute for court judgment.
        </p>
      </div>
      
      <JudgeSimulationView userRole="lawyer" />
    </div>
  )
}
