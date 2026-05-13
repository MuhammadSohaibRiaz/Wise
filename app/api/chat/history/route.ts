import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
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
  const t0 = Date.now()
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      console.log("[Chat:History] GET → 401 (no user)")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(req.url)
    const explicitCaseId = url.searchParams.get("caseId")
    const currentPath = url.searchParams.get("currentPath")
    const inferredCaseId = explicitCaseId || extractCaseIdFromPath(currentPath)
    console.log(`[Chat:History] GET ▶ user=${user.id.slice(0,8)}… | path=${currentPath} | explicitCase=${explicitCaseId || 'none'} | inferredCase=${inferredCaseId || 'none'}`)

    const { caseId: authorizedCaseId, errorResponse } = await resolveAuthorizedCaseId(
      supabase,
      user.id,
      inferredCaseId,
    )
    if (errorResponse) {
      console.warn(`[Chat:History] GET → case auth failed for ${inferredCaseId}`)
      return errorResponse
    }

    const limitParam = Number.parseInt(url.searchParams.get("limit") || "80", 10)
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 500) : 80
    const before = url.searchParams.get("before")

    let query = supabase.from("ai_chat_messages").select("*").eq("user_id", user.id)
    if (authorizedCaseId) query = query.eq("case_id", authorizedCaseId)
    if (before) query = query.lt("created_at", before)

    const { data, error } = await query.order("created_at", { ascending: false }).limit(limit + 1)

    if (error) {
      console.error("[Chat:History] GET ✗ query failed:", error)
      return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 })
    }

    const hasMore = (data || []).length > limit
    const pageData = hasMore ? (data || []).slice(0, limit) : (data || [])
    const messages = [...pageData].reverse()
    const nextCursor = hasMore ? pageData[pageData.length - 1]?.created_at || null : null

    console.log(`[Chat:History] GET ✓ ${messages.length} messages (hasMore=${hasMore}, caseId=${authorizedCaseId || 'global'}) [${Date.now() - t0}ms]`)

    return NextResponse.json({
      messages,
      caseId: authorizedCaseId || null,
      hasMore,
      nextCursor,
    })
  } catch (error) {
    console.error(`[Chat:History] GET ✗ unhandled [${Date.now() - t0}ms]:`, error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const t0 = Date.now()
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      console.log("[Chat:History] DELETE → 401 (no user)")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(req.url)
    const explicitCaseId = url.searchParams.get("caseId")
    const currentPath = url.searchParams.get("currentPath")
    const scope = url.searchParams.get("scope")
    const inferredCaseId = explicitCaseId || extractCaseIdFromPath(currentPath)
    console.log(`[Chat:History] DELETE ▶ user=${user.id.slice(0,8)}… | scope=${scope || 'none'} | explicitCase=${explicitCaseId || 'none'} | inferredCase=${inferredCaseId || 'none'}`)

    const { caseId: authorizedCaseId, errorResponse } = await resolveAuthorizedCaseId(
      supabase,
      user.id,
      inferredCaseId,
    )
    if (errorResponse) {
      console.warn("[Chat:History] DELETE → case auth failed")
      return errorResponse
    }

    const admin = createAdminClient()
    let deleteScope: string
    let query = admin.from("ai_chat_messages").delete().eq("user_id", user.id)
    if (authorizedCaseId) {
      query = query.eq("case_id", authorizedCaseId)
      deleteScope = `case=${authorizedCaseId}`
    } else if (scope === "global") {
      deleteScope = "global (all user messages)"
    } else {
      console.warn("[Chat:History] DELETE → 400 (no scope, no caseId)")
      return NextResponse.json({ error: "Missing case context for clear operation" }, { status: 400 })
    }

    console.log(`[Chat:History] DELETE → executing (${deleteScope}) via admin client...`)
    const { error, count } = await query.select("id", { count: "exact", head: false }) as any
    if (error) {
      console.error(`[Chat:History] DELETE ✗ query failed [${Date.now() - t0}ms]:`, error)
      return NextResponse.json({ error: "Failed to clear chat history" }, { status: 500 })
    }

    console.log(`[Chat:History] DELETE ✓ deleted ${count ?? '?'} rows (${deleteScope}) [${Date.now() - t0}ms]`)
    return NextResponse.json({ ok: true, caseId: authorizedCaseId || null, deletedCount: count ?? null })
  } catch (error) {
    console.error(`[Chat:History] DELETE ✗ unhandled [${Date.now() - t0}ms]:`, error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
