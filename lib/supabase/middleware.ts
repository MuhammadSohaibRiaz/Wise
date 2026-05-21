import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  let response = NextResponse.next({ request })

  // Public routes still get a Supabase session refresh below. The RAG endpoint
  // is public for legal KB questions, but it applies stricter guest behavior in
  // the route itself.
  const publicRoutes = [
    "/",
    "/auth",
    "/match",
    "/terms",
    "/privacy",
    "/client/lawyer",
    "/api/chat",
    "/api/legal-rag-chat",
    "/api/auth",
  ]
  const isPublicRoute = publicRoutes.some((route) => pathname === route || pathname.startsWith(route + "/"))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  function createRedirect(dest: string) {
    const url = request.nextUrl.clone()
    url.pathname = dest
    const redirectResponse = NextResponse.redirect(url)
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value)
    })
    return redirectResponse
  }

  // Middleware is the first RBAC layer for page navigation. API routes still
  // repeat ownership checks because direct HTTP calls bypass page components.
  const needsRoleCheck = !isPublicRoute && (pathname.startsWith("/admin") || pathname.startsWith("/client/") || pathname.startsWith("/lawyer/"))

  if (!user && !isPublicRoute) {
    const dest = pathname.startsWith("/admin")
      ? "/auth/admin/sign-in"
      : pathname.startsWith("/lawyer/")
        ? "/auth/lawyer/sign-in"
        : "/auth/client/sign-in"
    return createRedirect(dest)
  }

  if (user && !isPublicRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email_verified_at, user_type")
      .eq("id", user.id)
      .maybeSingle()

    const needsEmailVerification =
      profile?.user_type !== "admin" && !profile?.email_verified_at

    if (needsEmailVerification) {
      await supabase.auth.signOut()
      const dest = pathname.startsWith("/lawyer/")
        ? "/auth/lawyer/sign-in?error=unverified"
        : pathname.startsWith("/admin")
          ? "/auth/admin/sign-in?error=unverified"
          : "/auth/client/sign-in?error=unverified"
      return createRedirect(dest)
    }
  }

  if (user && needsRoleCheck) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_type")
      .eq("id", user.id)
      .maybeSingle()

    const userType = profile?.user_type

    if (pathname.startsWith("/admin") && userType !== "admin") {
      return createRedirect("/auth/admin/sign-in")
    }

    if (pathname.startsWith("/client/") && userType === "lawyer") {
      return createRedirect("/lawyer/dashboard")
    }

    if (pathname.startsWith("/lawyer/") && userType === "client") {
      return createRedirect("/client/dashboard")
    }
  }

  return response
}
