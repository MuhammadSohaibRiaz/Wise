import { NextResponse } from "next/server"
import { markProfileEmailVerified } from "@/lib/auth/email-verification"
import { createClient } from "@/lib/supabase/server"

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await markProfileEmailVerified(user.id)
  return NextResponse.json({ ok: true })
}
