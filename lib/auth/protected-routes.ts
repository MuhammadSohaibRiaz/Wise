/**
 * Central path rules for middleware and layout guards.
 * Keeps lawyer vs client vs admin sign-in redirects consistent.
 */

export function isAdminRoute(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin/")
}

export function isLawyerRoute(pathname: string): boolean {
  return getFirstPathSegment(pathname) === "lawyer"
}

/** Guest-accessible lawyer profile (under /client for public discovery). */
export function isPublicClientLawyerProfile(pathname: string): boolean {
  return pathname === "/client/lawyer" || pathname.startsWith("/client/lawyer/")
}

export function isClientProtectedRoute(pathname: string): boolean {
  if (getFirstPathSegment(pathname) === "client") {
    return !isPublicClientLawyerProfile(pathname)
  }
  return false
}

function getFirstPathSegment(pathname: string): string {
  return pathname.split(/[/?#]/).filter(Boolean)[0]?.toLowerCase() || ""
}

export function isPublicPath(pathname: string): boolean {
  if (
    pathname === "/" ||
    pathname === "/match" ||
    pathname.startsWith("/match/") ||
    pathname === "/terms" ||
    pathname === "/privacy" ||
    pathname === "/register"
  ) {
    return true
  }

  if (pathname === "/auth" || pathname.startsWith("/auth/")) {
    return true
  }

  if (isPublicClientLawyerProfile(pathname)) {
    return true
  }

  if (
    pathname === "/api/chat" ||
    pathname.startsWith("/api/chat/") ||
    pathname === "/api/legal-rag-chat" ||
    pathname.startsWith("/api/legal-rag-chat/") ||
    pathname === "/api/auth" ||
    pathname.startsWith("/api/auth/")
  ) {
    return true
  }

  return false
}

/** Where to send unauthenticated users; null if the path is public. */
export function getGuestSignInRedirect(pathname: string): string | null {
  if (isPublicPath(pathname)) return null
  if (isAdminRoute(pathname)) return "/auth/admin/sign-in"
  if (isLawyerRoute(pathname)) return "/auth/lawyer/sign-in"
  if (isClientProtectedRoute(pathname)) return "/auth/client/sign-in"
  return "/auth/client/sign-in"
}

export function routeNeedsRoleCheck(pathname: string): boolean {
  if (isPublicPath(pathname)) return false
  return isAdminRoute(pathname) || isLawyerRoute(pathname) || isClientProtectedRoute(pathname)
}
