import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { searchLawyersFromSupabase } from "@/lib/lawyer-search"

export const dynamic = "force-dynamic"

/**
 * Read-only lawyer search for widgets / chat fallback (no LLM tool JSON).
 * Query: ?q=name&specialty=Real+Estate&limit=8
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const query = searchParams.get("q") || searchParams.get("query") || ""
    const specialty = searchParams.get("specialty") || ""
    const limitRaw = searchParams.get("limit")
    const limit = Math.min(20, Math.max(1, Number.parseInt(limitRaw || "8", 10) || 8))

    const supabase = await createClient()
    const result = await searchLawyersFromSupabase(supabase, { specialty, query })
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      lawyers: result.lawyers.slice(0, limit),
      note: result.note,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
