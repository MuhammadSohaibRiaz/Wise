import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Public routes
  const publicRoutes = ["/", "/auth", "/match", "/terms", "/privacy", "/client/lawyer"]
  const isPublicRoute = publicRoutes.some((route) => pathname === route || pathname.startsWith(route + "/"))

  // Check for Supabase session cookie (standard name is sb-access-token or similar)
  // We just look for ANY cookie that looks like a Supabase session to allow the request through.
  // The actual validation and role-checking happens at the Page/Layout level in Server Components.
  const allCookies = request.cookies.getAll()
  const hasSession = allCookies.some(c => c.name.includes('supabase-auth-token') || c.name.includes('sb-'))

  if (!hasSession && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/client/sign-in"
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}
