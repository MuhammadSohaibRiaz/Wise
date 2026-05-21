import { NextResponse } from "next/server"

import { fetchAdminCancellationQueues } from "@/lib/admin/cancellation-queues"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_type")
    .eq("id", user.id)
    .maybeSingle()

  if (profile?.user_type !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const admin = createAdminClient()
    const queues = await fetchAdminCancellationQueues(admin)
    return NextResponse.json({
      pending_count: queues.pending_count,
      awaiting_refund_count: queues.awaiting_refund_count,
      total_actionable: queues.total_actionable,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to load counts"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
