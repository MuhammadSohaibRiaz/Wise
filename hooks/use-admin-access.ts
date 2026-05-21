"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export type AdminAccessState = "loading" | "allowed" | "redirecting"

/**
 * Client-side guard for /admin/* pages. Middleware is the first line of defense;
 * this prevents client-side exceptions if a non-admin page ever hydrates.
 */
export function useAdminAccess(): AdminAccessState {
  const router = useRouter()
  const [state, setState] = useState<AdminAccessState>("loading")

  useEffect(() => {
    let cancelled = false

    async function check() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        if (!cancelled) {
          setState("redirecting")
          router.replace("/auth/admin/sign-in")
        }
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .maybeSingle()

      if (profile?.user_type === "admin") {
        if (!cancelled) setState("allowed")
        return
      }

      if (!cancelled) {
        setState("redirecting")
        if (profile?.user_type === "lawyer") {
          router.replace("/lawyer/dashboard")
        } else if (profile?.user_type === "client") {
          router.replace("/client/dashboard")
        } else {
          router.replace("/auth/admin/sign-in")
        }
      }
    }

    void check()
    return () => {
      cancelled = true
    }
  }, [router])

  return state
}
