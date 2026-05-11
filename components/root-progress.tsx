"use client"

import { Suspense } from "react"
import { ProgressBar } from "@/components/progress-bar"

export function RootProgressBar() {
  return (
    <Suspense fallback={null}>
      <ProgressBar />
    </Suspense>
  )
}
