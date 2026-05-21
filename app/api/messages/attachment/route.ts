import { NextRequest, NextResponse } from "next/server"
import {
  bucketFromSupabaseUrl,
  encodeAttachment,
  storagePathFromSupabaseUrl,
} from "@/lib/chat/message-attachment"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

const MAX_BYTES = 15 * 1024 * 1024
async function userCanAccessCase(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  caseId: string,
): Promise<boolean> {
  const { data: caseRow, error } = await admin
    .from("cases")
    .select("client_id, lawyer_id")
    .eq("id", caseId)
    .maybeSingle()

  if (error || !caseRow) return false
  return caseRow.client_id === userId || caseRow.lawyer_id === userId
}

function safeFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120) || "file"
}

function contentDisposition(fileName: string, download: boolean) {
  const fallback = safeFileName(fileName)
  const type = download ? "attachment" : "inline"
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
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

    const form = await req.formData()
    const caseId = String(form.get("caseId") ?? "")
    const recipientId = String(form.get("recipientId") ?? "")
    const file = form.get("file")

    if (!caseId || !recipientId || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing caseId, recipientId, or file." }, { status: 400 })
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File must be 15 MB or smaller." }, { status: 400 })
    }

    const admin = createAdminClient()
    if (!(await userCanAccessCase(admin, user.id, caseId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const safeName = safeFileName(file.name)
    const path = `message-attachments/${caseId}/${Date.now()}_${safeName}`

    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await admin.storage.from("documents").upload(path, buffer, {
      contentType: file.type || "application/octet-stream",
      cacheControl: "3600",
      upsert: false,
    })

    if (uploadError) {
      console.error("[Messages:Attachment] Upload failed:", uploadError.message)
      return NextResponse.json({ error: "Upload failed." }, { status: 500 })
    }

    const caption = String(form.get("caption") ?? "").trim().slice(0, 150)
    const content = encodeAttachment({
      bucket: "documents",
      path,
      name: file.name,
      ...(caption ? { caption } : {}),
    })

    const { data: message, error: insertError } = await admin
      .from("messages")
      .insert({
        case_id: caseId,
        sender_id: user.id,
        recipient_id: recipientId,
        content,
      })
      .select()
      .single()

    if (insertError) {
      console.error("[Messages:Attachment] Insert failed:", insertError.message)
      return NextResponse.json({ error: "Message could not be saved." }, { status: 500 })
    }

    return NextResponse.json({ message })
  } catch (error) {
    console.error("[Messages:Attachment] POST error:", error)
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const caseId = req.nextUrl.searchParams.get("caseId")
    const bucket = req.nextUrl.searchParams.get("bucket")
    const path = req.nextUrl.searchParams.get("path")
    const legacyUrl = req.nextUrl.searchParams.get("url")

    if (!caseId) {
      return NextResponse.json({ error: "caseId is required." }, { status: 400 })
    }

    const admin = createAdminClient()
    if (!(await userCanAccessCase(admin, user.id, caseId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    let resolvedBucket = bucket
    let resolvedPath = path

    if (legacyUrl) {
      resolvedBucket = bucketFromSupabaseUrl(legacyUrl) ?? "avatars"
      resolvedPath = storagePathFromSupabaseUrl(legacyUrl)
    }

    if (!resolvedBucket || !resolvedPath) {
      return NextResponse.json({ error: "Invalid file reference." }, { status: 400 })
    }

    const fileName = decodeURIComponent(resolvedPath.split("/").pop() ?? "download")
    const { data: file, error: downloadError } = await admin.storage
      .from(resolvedBucket)
      .download(resolvedPath)

    if (downloadError || !file) {
      console.error("[Messages:Attachment] Download failed:", downloadError?.message)
      return NextResponse.json({ error: "File not found." }, { status: 404 })
    }

    return new Response(file.stream(), {
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "Content-Disposition": contentDisposition(fileName.replace(/^\d+_/, ""), true),
        "Cache-Control": "private, no-store",
      },
    })
  } catch (error) {
    console.error("[Messages:Attachment] GET error:", error)
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 })
  }
}
