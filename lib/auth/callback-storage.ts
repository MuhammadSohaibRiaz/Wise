/** Persist Supabase hash fragments across redirects (hash is often dropped by the router). */
const HASH_KEY = "wisecase_auth_callback_hash"

export function stashAuthHash(hash: string): void {
  if (typeof window === "undefined" || !hash) return
  sessionStorage.setItem(HASH_KEY, hash.startsWith("#") ? hash : `#${hash}`)
}

export function peekAuthHash(): string | null {
  if (typeof window === "undefined") return null
  return sessionStorage.getItem(HASH_KEY)
}

export function consumeAuthHash(): string | null {
  const value = peekAuthHash()
  if (value) sessionStorage.removeItem(HASH_KEY)
  return value
}

export function parseHashParams(hash: string): URLSearchParams {
  const normalized = hash.startsWith("#") ? hash.slice(1) : hash
  return new URLSearchParams(normalized)
}
