"use client"

import { JudgeSimulationView } from "@/components/ai/judge-simulation-view"

export default function LawyerJudgeSimulationPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">Judicial Simulation Tool</h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Simulate a courtroom environment to test your arguments against a strict judicial AI.
        </p>
      </div>
      
      <JudgeSimulationView userRole="lawyer" />
    </div>
  )
}
