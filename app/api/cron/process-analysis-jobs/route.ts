import { NextRequest, NextResponse } from "next/server"
import { processPendingAnalysisJobs } from "@/lib/analysis/process-analysis-job"

/**
 * Background processor for queued document analyses.
 * Secure with CRON_SECRET Bearer token and/or Vercel cron header.
 *
 * Set env CRON_SECRET and call:
 *   Authorization: Bearer <CRON_SECRET>
 * Or deploy on Vercel with vercel.json cron (x-vercel-cron header).
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const auth = req.headers.get("authorization")
  const vercelCron = req.headers.get("x-vercel-cron")

  const bearerOk = cronSecret && auth === `Bearer ${cronSecret}`
  const vercelOk = vercelCron === "1"

  if (!bearerOk && !vercelOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { processed } = await processPendingAnalysisJobs(8)
    return NextResponse.json({ ok: true, processed })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Cron failed"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
