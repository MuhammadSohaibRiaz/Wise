import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  let response = NextResponse.next({ request })

  // Public routes
  const publicRoutes = ["/", "/auth", "/match", "/terms", "/privacy", "/client/lawyer", "/api/chat"]
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

  const needsRoleCheck = !isPublicRoute && (pathname.startsWith("/admin") || pathname.startsWith("/client/") || pathname.startsWith("/lawyer/"))

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = pathname.startsWith("/admin") ? "/auth/admin/sign-in" : "/auth/client/sign-in"
    return NextResponse.redirect(url)
  }

  if (user && needsRoleCheck) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_type")
      .eq("id", user.id)
      .maybeSingle()

    const userType = profile?.user_type

    if (pathname.startsWith("/admin") && userType !== "admin") {
      const url = request.nextUrl.clone()
      url.pathname = "/auth/admin/sign-in"
      return NextResponse.redirect(url)
    }

    if (pathname.startsWith("/client/") && userType === "lawyer") {
      const url = request.nextUrl.clone()
      url.pathname = "/lawyer/dashboard"
      return NextResponse.redirect(url)
    }

    if (pathname.startsWith("/lawyer/") && userType === "client") {
      const url = request.nextUrl.clone()
      url.pathname = "/client/dashboard"
      return NextResponse.redirect(url)
    }
  }

  return response
}
