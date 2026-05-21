export function formatSuccessRateDisplay(completedCaseCount: number, successRate: number) {
  if (completedCaseCount <= 0) {
    return { label: "No cases yet", showPercent: false, percent: null as number | null }
  }
  const pct = Math.round(Math.max(0, Math.min(100, successRate)))
  return { label: `${pct}% success rate`, showPercent: true, percent: pct }
}

export const CASE_OUTCOME_LABELS: Record<string, string> = {
  won: "Case Won / Resolved in our favor",
  lost: "Case Lost / Ruled against us",
  settled: "Settled / Resolved mutually",
  ongoing: "Ongoing / Still unresolved",
}
