import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { extractCaseIdFromPath } from "@/lib/chat-case-context"

async function resolveAuthorizedCaseId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  inferredCaseId: string | null,
) {
  if (!inferredCaseId) return { caseId: null as string | null, errorResponse: null as NextResponse | null }

  const { data: caseRow, error: caseErr } = await supabase
    .from("cases")
    .select("id, client_id, lawyer_id")
    .eq("id", inferredCaseId)
    .maybeSingle()

  if (caseErr) {
    console.error("[Chat History] Case validation error:", caseErr)
    return {
      caseId: null as string | null,
      errorResponse: NextResponse.json({ error: "Failed to validate case context" }, { status: 500 }),
    }
  }

  if (!caseRow || (caseRow.client_id !== userId && caseRow.lawyer_id !== userId)) {
    return {
      caseId: null as string | null,
      errorResponse: NextResponse.json({ error: "Forbidden case context" }, { status: 403 }),
    }
  }

  return { caseId: caseRow.id, errorResponse: null as NextResponse | null }
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(req.url)
    const explicitCaseId = url.searchParams.get("caseId")
    const currentPath = url.searchParams.get("currentPath")
    const inferredCaseId = explicitCaseId || extractCaseIdFromPath(currentPath)

    const { caseId: authorizedCaseId, errorResponse } = await resolveAuthorizedCaseId(
      supabase,
      user.id,
      inferredCaseId,
    )
    if (errorResponse) return errorResponse

    const limitParam = Number.parseInt(url.searchParams.get("limit") || "80", 10)
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 500) : 80
    const before = url.searchParams.get("before")

    let query = supabase.from("ai_chat_messages").select("*").eq("user_id", user.id)
    if (authorizedCaseId) query = query.eq("case_id", authorizedCaseId)
    if (before) query = query.lt("created_at", before)

    const { data, error } = await query.order("created_at", { ascending: false }).limit(limit + 1)

    if (error) {
      console.error("[Chat History] Error fetching:", error)
      return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 })
    }

    const hasMore = (data || []).length > limit
    const pageData = hasMore ? (data || []).slice(0, limit) : (data || [])
    const messages = [...pageData].reverse()
    const nextCursor = hasMore ? pageData[pageData.length - 1]?.created_at || null : null

    return NextResponse.json({
      messages,
      caseId: authorizedCaseId || null,
      hasMore,
      nextCursor,
    })
  } catch (error) {
    console.error("[Chat History] Catch error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(req.url)
    const explicitCaseId = url.searchParams.get("caseId")
    const currentPath = url.searchParams.get("currentPath")
    const inferredCaseId = explicitCaseId || extractCaseIdFromPath(currentPath)

    const { caseId: authorizedCaseId, errorResponse } = await resolveAuthorizedCaseId(
      supabase,
      user.id,
      inferredCaseId,
    )
    if (errorResponse) return errorResponse

    let query = supabase.from("ai_chat_messages").delete().eq("user_id", user.id)
    if (authorizedCaseId) {
      query = query.eq("case_id", authorizedCaseId)
    } else if (url.searchParams.get("scope") === "global") {
      // explicit global scope supported
    } else {
      // avoid accidental global wipe without explicit scope
      return NextResponse.json({ error: "Missing case context for clear operation" }, { status: 400 })
    }

    const { error } = await query
    if (error) {
      console.error("[Chat History] Delete failed:", error)
      return NextResponse.json({ error: "Failed to clear chat history" }, { status: 500 })
    }

    return NextResponse.json({ ok: true, caseId: authorizedCaseId || null })
  } catch (error) {
    console.error("[Chat History] Delete catch error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
