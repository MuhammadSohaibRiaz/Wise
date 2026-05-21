/**
 * One-off diagnostic: node scripts/test-verification-email.mjs your@email.com
 * Loads .env.local and tests generateLink + Resend without sending (dry-run optional).
 */
import { readFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

function loadEnv() {
  try {
    const raw = readFileSync(resolve(root, ".env.local"), "utf8")
    for (const line of raw.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1].trim()] = m[2].trim()
    }
  } catch (e) {
    console.error("Could not read .env.local", e.message)
    process.exit(1)
  }
}

loadEnv()

const email = process.argv[2]
if (!email) {
  console.error("Usage: node scripts/test-verification-email.mjs you@example.com")
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const resendKey = process.env.RESEND_API_KEY
const redirectTo = `${(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "")}/auth/callback?next=/auth/client/sign-in`

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

console.log("--- Profile lookup ---")
const { data: profile, error: profileErr } = await admin
  .from("profiles")
  .select("id, email, user_type, email_verified_at")
  .ilike("email", email)
  .maybeSingle()
console.log("profile:", profile, "error:", profileErr?.message)

for (const type of ["signup", "magiclink", "invite"]) {
  console.log(`\n--- generateLink type=${type} ---`)
  const { data, error } = await admin.auth.admin.generateLink({
    type,
    email: email.toLowerCase(),
    options: { redirectTo },
  })
  if (error) {
    console.log("ERROR:", error.message, error.status)
  } else {
    console.log("OK, action_link present:", Boolean(data?.properties?.action_link))
    console.log("user id:", data?.user?.id)
    if (data?.properties?.action_link) {
      console.log("link prefix:", data.properties.action_link.slice(0, 80) + "...")
    }
  }
}

if (resendKey) {
  console.log("\n--- Resend API key domains (test send skipped unless --send) ---")
  const resend = new Resend(resendKey)
  if (process.argv.includes("--send") && profile) {
    const { data: linkData } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: email.toLowerCase(),
      options: { redirectTo },
    })
    const link = linkData?.properties?.action_link
    if (!link) {
      console.log("No link to send")
      process.exit(1)
    }
    const { data, error } = await resend.emails.send({
      from: "WiseCase <noreply@rapidnextech.com>",
      to: email,
      subject: "WiseCase verification test",
      html: `<p>Test link: <a href="${link}">Verify</a></p>`,
    })
    console.log("Resend result:", data, error)
  } else {
    console.log("Add --send to actually send one test email via Resend")
  }
} else {
  console.log("\nRESEND_API_KEY missing")
}
