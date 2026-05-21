import { parseHashParams } from "@/lib/auth/callback-storage"
import type { AuthUserType } from "@/lib/auth/redirect-urls"

/** Read user_type from a Supabase access_token JWT in the URL hash (best-effort). */
export function getUserTypeFromAccessTokenHash(hash: string): AuthUserType | null {
  const params = parseHashParams(hash)
  const token = params.get("access_token")
  if (!token) return null
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")))
    const type = payload?.user_metadata?.user_type
    return type === "lawyer" ? "lawyer" : type === "client" ? "client" : null
  } catch {
    return null
  }
}
