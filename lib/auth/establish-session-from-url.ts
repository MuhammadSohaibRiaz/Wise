import type { SupabaseClient } from "@supabase/supabase-js"
import { consumeAuthHash, parseHashParams } from "@/lib/auth/callback-storage"

export type EstablishSessionResult =
  | { ok: true; linkType: string | null; sessionEstablished: boolean }
  | { ok: false; error: string; errorCode: string | null }

/**
 * Completes Supabase auth from ?code=... and/or #access_token=... (password reset, verify, etc.).
 */
export async function establishSessionFromAuthUrl(
  supabase: SupabaseClient,
  options: {
    searchParams: URLSearchParams
    hashFromWindow?: string
  },
): Promise<EstablishSessionResult> {
  let hashRaw = options.hashFromWindow ?? ""
  if (hashRaw) {
    consumeAuthHash()
  } else {
    hashRaw = consumeAuthHash() || ""
  }

  const linkTypeParam = options.searchParams.get("type")

  if (hashRaw) {
    const hashParams = parseHashParams(hashRaw)
    if (hashParams.get("error") || hashParams.get("error_code")) {
      return {
        ok: false,
        error:
          hashParams.get("error_description")?.replace(/\+/g, " ") ??
          "Link invalid or expired.",
        errorCode: hashParams.get("error_code"),
      }
    }
  }

  const code = options.searchParams.get("code")
  let linkType: string | null = linkTypeParam

  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) {
      return { ok: false, error: exchangeError.message, errorCode: null }
    }
    return { ok: true, linkType, sessionEstablished: true }
  }

  if (hashRaw) {
    const hashParams = parseHashParams(hashRaw)
    linkType = linkType ?? hashParams.get("type")
    const access_token = hashParams.get("access_token")
    const refresh_token = hashParams.get("refresh_token")

    if (!access_token || !refresh_token) {
      return { ok: false, error: "Invalid or expired link.", errorCode: null }
    }

    const { error: sessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    })
    if (sessionError) {
      return { ok: false, error: sessionError.message, errorCode: null }
    }

    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`)
    }

    return { ok: true, linkType, sessionEstablished: true }
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (session) {
    return { ok: true, linkType, sessionEstablished: true }
  }

  return { ok: false, error: "Invalid or expired link.", errorCode: null }
}

export function isPasswordRecoveryLink(linkType: string | null, nextPath: string | null): boolean {
  return linkType === "recovery" || nextPath === "/auth/reset-password"
}
