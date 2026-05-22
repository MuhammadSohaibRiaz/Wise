import { NextRequest, NextResponse } from "next/server"

import {
  fileNameFromStoragePath,
  guessContentTypeFromPath,
  storagePathFromVerificationUrl,
} from "@/lib/storage/verification-storage"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

function inlineDisposition(fileName: string) {
  const fallback = fileName.replace(/[^\w.-]/g, "_").slice(0, 120) || "license"
  return `inline; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
}

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("user_type")
    .eq("id", user.id)
    .maybeSingle()

  if (error || profile?.user_type !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { user }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const lawyerId = params.id?.trim()
  if (!lawyerId) {
    return NextResponse.json({ error: "Lawyer id is required" }, { status: 400 })
  }

  try {
    const admin = createAdminClient()
    const { data: lawyerProfile, error: profileError } = await admin
      .from("lawyer_profiles")
      .select("license_file_url")
      .eq("id", lawyerId)
      .maybeSingle()

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    if (!lawyerProfile?.license_file_url) {
      return NextResponse.json({ error: "No license document on file" }, { status: 404 })
    }

    const storagePath = storagePathFromVerificationUrl(lawyerProfile.license_file_url)
    if (!storagePath) {
      return NextResponse.json({ error: "License file path is invalid" }, { status: 500 })
    }

    const { data: file, error: downloadError } = await admin.storage
      .from("verifications")
      .download(storagePath)

    if (downloadError || !file) {
      console.error("[Admin:LicenseView] Download failed:", downloadError?.message)
      return NextResponse.json({ error: "License file is unavailable" }, { status: 404 })
    }

    const fileName = fileNameFromStoragePath(storagePath)

    return new Response(file.stream(), {
      headers: {
        "Content-Type": guessContentTypeFromPath(storagePath) || file.type || "application/octet-stream",
        "Content-Disposition": inlineDisposition(fileName),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    console.error("[Admin:LicenseView] Unexpected error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
