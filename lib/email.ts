// Required env var: RESEND_API_KEY  (server-only, no NEXT_PUBLIC_ prefix)
import { Resend } from "resend"

let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}

const FROM_ADDRESS = "WiseCase <onboarding@resend.dev>"

interface SendEmailParams {
  to: string
  subject: string
  html: string
}

/**
 * Fire-and-forget email sender. Logs errors to console, never throws.
 * Safe to call without `await` from any server-side context.
 */
export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<boolean> {
  try {
    const { error } = await getResend().emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
    })
    if (error) {
      console.error("[Email] Resend API error:", error.message)
      return false
    }
    return true
  } catch (err) {
    console.error("[Email] Unexpected send error:", err)
    return false
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

interface EmailTemplateParams {
  title: string
  /** HTML body content — callers must pre-escape any user-supplied text. */
  body: string
  ctaText: string
  ctaUrl: string
}

/** Build a clean, inline-styled HTML email with WiseCase branding. */
export function buildEmailHtml({ title, body, ctaText, ctaUrl }: EmailTemplateParams): string {
  const safeTitle = escapeHtml(title)
  const safeCta = escapeHtml(ctaText)
  const safeUrl = encodeURI(ctaUrl)
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
        <!-- Header -->
        <tr><td style="background:#0f172a;padding:24px 32px">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.025em">WiseCase</h1>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px">
          <h2 style="margin:0 0 16px;color:#111827;font-size:18px;font-weight:600">${safeTitle}</h2>
          <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6">${body}</p>
          <a href="${safeUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600">${safeCta}</a>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 32px;border-top:1px solid #e5e7eb">
          <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5">This is an automated notification from WiseCase. Do not reply to this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
