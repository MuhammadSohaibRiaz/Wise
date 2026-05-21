import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendVerificationEmailForUser, type AuthUserType } from "@/lib/auth/email-verification"

const rateLimit = new Map<string, { windowStart: number; count: number }>()
const RATE_WINDOW_MS = 60_000
const MAX_PER_WINDOW = 3

function isRateLimited(email: string): boolean {
  const now = Date.now()
  const entry = rateLimit.get(email)
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    rateLimit.set(email, { windowStart: now, count: 1 })
    return false
  }
  if (entry.count >= MAX_PER_WINDOW) return true
  entry.count += 1
  return false
}

export async function POST(req: NextRequest) {
  let body: { email?: string; userType?: AuthUserType }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  const userType = body.userType === "lawyer" ? "lawyer" : "client"

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 })
  }

  if (isRateLimited(email)) {
    return NextResponse.json({ error: "Too many requests. Please wait a minute." }, { status: 429 })
  }

  const admin = createAdminClient()
  let profile: { id: string; user_type: string; email_verified_at: string | null } | null = null
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data } = await admin
      .from("profiles")
      .select("id, user_type, email_verified_at")
      .ilike("email", email)
      .maybeSingle()
    if (data) {
      profile = data
      break
    }
    await new Promise((r) => setTimeout(r, 200))
  }

  if (!profile) {
    console.warn("[Auth] send-verification: no profile row for email", email)
    return NextResponse.json(
      { error: "No account found for this email. Please register first." },
      { status: 404 },
    )
  }

  if (profile.email_verified_at) {
    return NextResponse.json({ ok: true })
  }

  if (profile.user_type === "admin") {
    return NextResponse.json({ ok: true })
  }

  const resolvedType: AuthUserType = profile.user_type === "lawyer" ? "lawyer" : userType

  const result = await sendVerificationEmailForUser(profile.id, email, resolvedType)
  if (!result.ok) {
    console.error("[Auth] send verification failed:", result.error)
    return NextResponse.json(
      { error: result.error || "Could not send verification email" },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
