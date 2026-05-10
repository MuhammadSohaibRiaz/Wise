import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("ai_chat_messages")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("[Chat History] Error fetching:", error)
      return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 })
    }

    // Map to Vercel AI SDK format if needed, but for now we'll send as is
    // and handle mapping in the component if necessary.
    return NextResponse.json({ messages: data || [] })
  } catch (error) {
    console.error("[Chat History] Catch error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
