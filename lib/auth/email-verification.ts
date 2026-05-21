import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAuthCallbackUrl } from "@/lib/auth/redirect-urls"
import { buildEmailHtml, escapeHtml, sendEmail } from "@/lib/email"

export type AuthUserType = "client" | "lawyer"

export function getEmailCallbackUrl(userType: AuthUserType): string {
  const next = userType === "lawyer" ? "/auth/lawyer/sign-in" : "/auth/client/sign-in"
  return getAuthCallbackUrl(next)
}

/**
 * Sends a verification link via Resend and ensures the auth user stays unconfirmed
 * until the link is clicked (works even when Supabase "Confirm email" is off).
 */
export async function sendVerificationEmailForUser(
  userId: string,
  email: string,
  userType: AuthUserType,
): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: "Email service is not configured (RESEND_API_KEY missing)." }
  }

  const admin = createAdminClient()
  const redirectTo = getEmailCallbackUrl(userType)
  const normalizedEmail = email.trim().toLowerCase()

  // "signup" only works when creating a brand-new user with a password.
  // After client signUp the user already exists — use "magiclink" for the verify link.
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: normalizedEmail,
    options: { redirectTo },
  })

  if (linkError || !linkData?.properties?.action_link) {
    console.error("[Auth] generateLink (magiclink) failed:", linkError?.message, linkError?.status)
    return { ok: false, error: linkError?.message || "Could not generate verification link." }
  }

  const resolvedUserId = linkData.user?.id ?? userId
  if (resolvedUserId) {
    await admin.auth.admin.updateUserById(resolvedUserId, { email_confirm: false })
  }

  const actionLink = linkData.properties.action_link
  const safeEmail = escapeHtml(email)
  const html = buildEmailHtml({
    title: "Verify your WiseCase email",
    body: `Hi ${safeEmail},<br><br>Thanks for signing up. Click the button below to verify your email address. You must verify before you can sign in and use WiseCase.`,
    ctaText: "Verify email address",
    ctaUrl: actionLink,
  })

  const sent = await sendEmail({
    to: normalizedEmail,
    subject: "Verify your WiseCase account",
    html,
  })

  if (!sent) {
    return { ok: false, error: "Failed to send verification email. Please try again later." }
  }

  if (resolvedUserId) {
    await admin.from("profiles").update({ email_verified_at: null }).eq("id", resolvedUserId)
  }

  return { ok: true }
}

export async function markProfileEmailVerified(userId: string): Promise<void> {
  const admin = createAdminClient()
  await admin
    .from("profiles")
    .update({ email_verified_at: new Date().toISOString() })
    .eq("id", userId)
}
