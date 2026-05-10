"use client"

import { JudgeSimulationView } from "@/components/ai/judge-simulation-view"

export default function ClientJudgeSimulationPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">AI Judge Simulation</h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Validate your case strategy and preview potential outcomes before going to court.
        </p>
      </div>
      
      <JudgeSimulationView userRole="client" />
    </div>
  )
}
