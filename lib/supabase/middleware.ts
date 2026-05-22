import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import {
  getGuestSignInRedirect,
  isAdminRoute,
  isClientProtectedRoute,
  isLawyerRoute,
  isPublicPath,
  routeNeedsRoleCheck,
} from "@/lib/auth/protected-routes"
import {
  isLawyerLicenseApproved,
  isLawyerLicenseExemptPath,
} from "@/lib/lawyer-license-verification"

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (pathname === "/admin/dshboard") {
    return NextResponse.redirect(new URL("/admin/dashboard", request.url))
  }

  let response = NextResponse.next({ request })

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
    const url = new URL(dest, request.url)
    const redirectResponse = NextResponse.redirect(url)
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value)
    })
    return redirectResponse
  }

  if (!user) {
    const dest = getGuestSignInRedirect(pathname)
    if (dest) {
      return createRedirect(dest)
    }
  }

  if (user && !isPublicPath(pathname)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email_verified_at, user_type")
      .eq("id", user.id)
      .maybeSingle()

    const needsEmailVerification =
      profile?.user_type !== "admin" && !profile?.email_verified_at

    if (needsEmailVerification) {
      await supabase.auth.signOut()
      const dest = isLawyerRoute(pathname)
        ? "/auth/lawyer/sign-in?error=unverified"
        : isAdminRoute(pathname)
          ? "/auth/admin/sign-in?error=unverified"
          : "/auth/client/sign-in?error=unverified"
      return createRedirect(dest)
    }
  }

  if (
    user &&
    isLawyerRoute(pathname) &&
    !isLawyerLicenseExemptPath(pathname)
  ) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_type")
      .eq("id", user.id)
      .maybeSingle()

    if (profile?.user_type === "lawyer") {
      const { data: lawyerProfile } = await supabase
        .from("lawyer_profiles")
        .select("verification_status")
        .eq("id", user.id)
        .maybeSingle()

      if (!isLawyerLicenseApproved(lawyerProfile)) {
        return createRedirect("/lawyer/verification")
      }
    }
  }

  if (user && routeNeedsRoleCheck(pathname)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_type")
      .eq("id", user.id)
      .maybeSingle()

    const userType = profile?.user_type

    if (isAdminRoute(pathname) && userType !== "admin") {
      if (userType === "lawyer") {
        const { data: lawyerProfile } = await supabase
          .from("lawyer_profiles")
          .select("verification_status")
          .eq("id", user.id)
          .maybeSingle()
        if (!isLawyerLicenseApproved(lawyerProfile)) {
          return createRedirect("/lawyer/verification")
        }
        return createRedirect("/lawyer/dashboard")
      }
      if (userType === "client") {
        return createRedirect("/client/dashboard")
      }
      return createRedirect("/auth/admin/sign-in")
    }

    if (isClientProtectedRoute(pathname) && userType === "lawyer") {
      const { data: lawyerProfile } = await supabase
        .from("lawyer_profiles")
        .select("verification_status")
        .eq("id", user.id)
        .maybeSingle()
      if (!isLawyerLicenseApproved(lawyerProfile)) {
        return createRedirect("/lawyer/verification")
      }
      return createRedirect("/lawyer/dashboard")
    }

    if (isLawyerRoute(pathname) && userType === "client") {
      return createRedirect("/client/dashboard")
    }
  }

  return response
}
