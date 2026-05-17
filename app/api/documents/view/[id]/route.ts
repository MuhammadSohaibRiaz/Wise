import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

function storagePathFromUrl(fileUrl: string) {
  try {
    const url = new URL(fileUrl)
    const markers = [
      "/storage/v1/object/public/documents/",
      "/storage/v1/object/sign/documents/",
    ]
    for (const marker of markers) {
      const index = url.pathname.indexOf(marker)
      if (index >= 0) {
        return decodeURIComponent(url.pathname.slice(index + marker.length))
      }
    }
    return null
  } catch {
    return fileUrl.startsWith("documents/") ? fileUrl.slice("documents/".length) : fileUrl
  }
}

function inlineDisposition(fileName: string) {
  const fallback = fileName.replace(/[^\w.-]/g, "_").slice(0, 120) || "document"
  return `inline; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data: document, error: documentError } = await admin
      .from("documents")
      .select("id, case_id, uploaded_by, file_name, file_url, file_type")
      .eq("id", params.id)
      .maybeSingle()

    if (documentError) {
      console.error("[Documents:View] Fetch failed:", documentError.message)
      return NextResponse.json({ error: "Unable to load document." }, { status: 500 })
    }

    if (!document) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 })
    }

    let allowed = document.uploaded_by === user.id
    if (!allowed && document.case_id) {
      const { data: caseRow, error: caseError } = await admin
        .from("cases")
        .select("client_id, lawyer_id")
        .eq("id", document.case_id)
        .maybeSingle()

      if (caseError) {
        console.error("[Documents:View] Case authorization fetch failed:", caseError.message)
        return NextResponse.json({ error: "Unable to verify access." }, { status: 500 })
      }

      allowed = caseRow?.client_id === user.id || caseRow?.lawyer_id === user.id
    }

    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const storagePath = storagePathFromUrl(document.file_url)
    if (!storagePath) {
      return NextResponse.json({ error: "Document file path is invalid." }, { status: 500 })
    }

    const { data: file, error: downloadError } = await admin.storage
      .from("documents")
      .download(storagePath)

    if (downloadError || !file) {
      console.error("[Documents:View] Download failed:", downloadError?.message)
      return NextResponse.json({ error: "Document file is unavailable." }, { status: 404 })
    }

    return new Response(file.stream(), {
      headers: {
        "Content-Type": document.file_type || file.type || "application/octet-stream",
        "Content-Disposition": inlineDisposition(document.file_name),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    console.error("[Documents:View] Unexpected error:", error)
    return NextResponse.json({ error: "Internal error." }, { status: 500 })
  }
}
