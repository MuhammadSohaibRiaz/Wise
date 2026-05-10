export type ChatRole = "guest" | "client" | "lawyer"

/**
 * Normalize AI/tool navigation paths to real app routes and correct role mistakes.
 */
export function normalizeChatNavigationPath(path: string, role: ChatRole): string {
  let p = (path || "").trim()
  if (!p.startsWith("/")) p = `/${p}`
  const lower = p.toLowerCase()

  if (lower === "/login") {
    return role === "lawyer" ? "/auth/lawyer/sign-in" : "/auth/client/sign-in"
  }

  if (lower === "/register") {
    return role === "lawyer" ? "/auth/lawyer/register" : "/register"
  }

  // Ambiguous shortcuts → role-specific real pages
  if (lower === "/settings" || lower === "/profile/settings" || lower === "/account") {
    if (role === "lawyer") return "/lawyer/profile"
    if (role === "client") return "/client/settings"
    return "/auth/client/sign-in"
  }

  if (lower === "/dashboard") {
    if (role === "lawyer") return "/lawyer/dashboard"
    if (role === "client") return "/client/dashboard"
    return "/auth/client/sign-in"
  }

  if (lower === "/appointments" || lower === "/my-appointments") {
    if (role === "lawyer") return "/lawyer/appointments"
    if (role === "client") return "/client/appointments"
    return "/auth/client/sign-in"
  }

  // Fix common wrong-role paths
  if (role === "lawyer") {
    if (lower.startsWith("/client/appointments")) return "/lawyer/appointments"
    if (lower.startsWith("/client/dashboard")) return "/lawyer/dashboard"
    if (lower.startsWith("/client/settings")) return "/lawyer/profile"
    if (lower.startsWith("/client/cases")) return p.replace(/^\/client\/cases/, "/lawyer/cases")
    if (lower === "/client/analysis") return "/lawyer/dashboard"
  }

  if (role === "client") {
    if (lower.startsWith("/lawyer/appointments")) return "/client/appointments"
    if (lower.startsWith("/lawyer/dashboard")) return "/client/dashboard"
    if (lower.startsWith("/lawyer/cases")) return p.replace(/^\/lawyer\/cases/, "/client/cases")
    if (lower.startsWith("/lawyer/profile")) return "/client/settings"
  }

  return p
}
