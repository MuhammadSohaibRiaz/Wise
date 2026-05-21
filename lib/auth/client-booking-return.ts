/** Query keys used when returning from client auth to complete a booking. */
export const BOOK_LAWYER_QUERY = "bookLawyer"
export const BOOK_ON_PROFILE_QUERY = "book"

const LAWYER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Return path after sign-in: /match with lawyer id (public route, works for guest → auth flow). */
export function buildMatchBookReturnUrl(lawyerId: string, currentSearch?: string): string {
  const params = new URLSearchParams(
    currentSearch?.startsWith("?") ? currentSearch.slice(1) : currentSearch || "",
  )
  params.set(BOOK_LAWYER_QUERY, lawyerId)
  const q = params.toString()
  return q ? `/match?${q}` : `/match?${BOOK_LAWYER_QUERY}=${lawyerId}`
}

/** Return path after sign-in: lawyer profile with booking modal flag. */
export function buildProfileBookReturnUrl(lawyerId: string): string {
  return `/client/lawyer/${lawyerId}?${BOOK_ON_PROFILE_QUERY}=1`
}

export function buildClientSignInToBookUrl(returnPath: string): string {
  return `/auth/client/sign-in?message=sign-in-to-book&next=${encodeURIComponent(returnPath)}`
}

/** Allowed post-auth destinations for the book flow (blocks open redirects). */
export function sanitizeClientPostAuthNext(next: string | null | undefined): string | null {
  if (!next || typeof next !== "string") return null
  const trimmed = next.trim()
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) {
    return null
  }

  try {
    const url = new URL(trimmed, "http://local")
    const path = url.pathname

    if (path === "/match") {
      const lawyerId = url.searchParams.get(BOOK_LAWYER_QUERY)
      if (lawyerId && !LAWYER_ID_PATTERN.test(lawyerId)) return null
      return url.pathname + url.search
    }

    const profileMatch = path.match(/^\/client\/lawyer\/([^/]+)$/)
    if (profileMatch) {
      const lawyerId = profileMatch[1]
      if (!LAWYER_ID_PATTERN.test(lawyerId)) return null
      return url.pathname + url.search
    }
  } catch {
    return null
  }

  return null
}

export function appendNextToAuthPath(
  basePath: string,
  next: string | null,
  extraParams?: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams()
  if (extraParams) {
    for (const [k, v] of Object.entries(extraParams)) {
      if (v) params.set(k, v)
    }
  }
  if (next) params.set("next", next)
  const q = params.toString()
  return q ? `${basePath}?${q}` : basePath
}
