import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

function normalizeFileName(value: unknown) {
  if (typeof value !== "string") return ""
  return value
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120)
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await req.json().catch(() => null)) as {
      documentId?: string
      fileName?: string
    } | null

    const documentId = body?.documentId
    const fileName = normalizeFileName(body?.fileName)

    if (!documentId || !fileName) {
      return NextResponse.json({ error: "Document ID and file name are required." }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: document, error: documentError } = await admin
      .from("documents")
      .select(`
        id,
        uploaded_by,
        case:cases!documents_case_id_fkey (
          status
        )
      `)
      .eq("id", documentId)
      .maybeSingle()

    if (documentError) {
      console.error("[Documents:Rename] Fetch failed:", documentError.message)
      return NextResponse.json({ error: "Unable to load document." }, { status: 500 })
    }

    if (!document) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 })
    }

    if (document.uploaded_by !== user.id) {
      return NextResponse.json({ error: "Only the uploader can rename this document." }, { status: 403 })
    }

    const caseStatus = Array.isArray(document.case) ? document.case[0]?.status : document.case?.status
    if (caseStatus === "completed" || caseStatus === "closed") {
      return NextResponse.json({ error: "Finished cases do not allow document edits." }, { status: 409 })
    }

    const { error: updateError } = await admin
      .from("documents")
      .update({ file_name: fileName })
      .eq("id", documentId)
      .eq("uploaded_by", user.id)

    if (updateError) {
      console.error("[Documents:Rename] Update failed:", updateError.message)
      return NextResponse.json({ error: "Could not rename document." }, { status: 500 })
    }

    return NextResponse.json({ ok: true, fileName })
  } catch (error) {
    console.error("[Documents:Rename] Unexpected error:", error)
    return NextResponse.json({ error: "Internal error." }, { status: 500 })
  }
}
