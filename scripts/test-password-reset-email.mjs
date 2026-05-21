/**
 * Diagnostic: node scripts/test-password-reset-email.mjs you@example.com
 * Prints the redirect URL used by forgot-password and tests generateLink(recovery).
 */
import { readFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import { createClient } from "@supabase/supabase-js"

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
  console.error("Usage: node scripts/test-password-reset-email.mjs you@example.com")
  process.exit(1)
}

const site = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "")
const redirectTo = `${site}/auth/callback?next=${encodeURIComponent("/auth/reset-password")}`

console.log("NEXT_PUBLIC_SITE_URL:", site)
console.log("resetPasswordForEmail redirectTo:", redirectTo)
console.log("\nSupabase Dashboard → Auth → URL configuration must allow:")
console.log(" - Site URL:", site)
console.log(" - Redirect URL:", redirectTo)
console.log(" - Redirect URL:", `${site}/auth/reset-password`)
console.log(" - Redirect URL:", `${site}/auth/callback`)

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error("\nMissing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

console.log("\n--- generateLink type=recovery ---")
const { data, error } = await admin.auth.admin.generateLink({
  type: "recovery",
  email: email.toLowerCase(),
  options: { redirectTo },
})

if (error) {
  console.log("ERROR:", error.message, error.status)
  process.exit(1)
}

console.log("OK, action_link present:", Boolean(data?.properties?.action_link))
if (data?.properties?.action_link) {
  const link = data.properties.action_link
  console.log("link prefix:", link.slice(0, 100) + "...")
  try {
    const u = new URL(link)
    const redirect = u.searchParams.get("redirect_to")
    console.log("redirect_to param:", redirect)
    if (redirect && !redirect.includes("/auth/callback")) {
      console.warn("WARN: redirect_to does not point at /auth/callback — check Supabase template/site URL")
    }
  } catch {
    console.log("(could not parse action_link as URL)")
  }
}

console.log("\nDry-run only — no email sent. Use the app forgot-password form to send the real email.")
