"use client"

import { JudgeSimulationView } from "@/components/ai/judge-simulation-view"

export default function ClientJudgeSimulationPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">AI Judicial Perspective Simulator</h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Stress-test your legal arguments from a judicial viewpoint — explore strengths and risks of your position. Not a prediction of court outcomes.
        </p>
      </div>
      
      <JudgeSimulationView userRole="client" />
    </div>
  )
}
