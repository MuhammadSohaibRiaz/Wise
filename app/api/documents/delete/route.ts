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

    const { documentId } = (await req.json()) as { documentId?: string }
    if (!documentId) {
      return NextResponse.json({ error: "Missing documentId" }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: doc } = await admin
      .from("documents")
      .select("id, uploaded_by")
      .eq("id", documentId)
      .single()

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    if (doc.uploaded_by !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { error: analysisErr } = await admin
      .from("document_analysis")
      .delete()
      .eq("document_id", documentId)

    if (analysisErr) {
      console.error("[Documents:Delete] Failed to delete analysis:", analysisErr.message)
    }

    const { error: docErr } = await admin
      .from("documents")
      .delete()
      .eq("id", documentId)

    if (docErr) {
      console.error("[Documents:Delete] Failed to delete document:", docErr.message)
      return NextResponse.json({ error: "Failed to delete document" }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[Documents:Delete] Unexpected error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
