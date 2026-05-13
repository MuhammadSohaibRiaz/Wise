import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { messageIds } = (await req.json()) as { messageIds?: string[] }
    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return NextResponse.json({ error: "Missing messageIds" }, { status: 400 })
    }

    const admin = createAdminClient()

    const { error, count } = await admin
      .from("messages")
      .update({ is_read: true })
      .in("id", messageIds)
      .eq("recipient_id", user.id)
      .select("id", { count: "exact", head: false }) as any

    if (error) {
      console.error("[Messages:MarkRead] Error:", error.message)
      return NextResponse.json({ error: "Failed to mark messages as read" }, { status: 500 })
    }

    return NextResponse.json({ ok: true, updated: count ?? 0 })
  } catch (err) {
    console.error("[Messages:MarkRead] Unexpected error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
