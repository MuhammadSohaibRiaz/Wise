import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  let response = NextResponse.next({ request })

  // Public routes
  const publicRoutes = ["/", "/auth", "/match", "/terms", "/privacy", "/client/lawyer"]
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

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/client/sign-in"
    return NextResponse.redirect(url)
  }

  if (pathname.startsWith("/admin")) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = "/auth/admin/sign-in"
      return NextResponse.redirect(url)
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("user_type")
      .eq("id", user.id)
      .maybeSingle()

    if (profile?.user_type !== "admin") {
      const url = request.nextUrl.clone()
      url.pathname = "/auth/admin/sign-in"
      return NextResponse.redirect(url)
    }
  }

  return response
}
