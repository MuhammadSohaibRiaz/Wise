import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("❌ Supabase environment variables are missing!")
    console.error("Please check your .env.local file and ensure these variables are set:")
    console.error("  - NEXT_PUBLIC_SUPABASE_URL")
    console.error("  - NEXT_PUBLIC_SUPABASE_ANON_KEY")
    console.error("\nGet your credentials from: https://app.supabase.com/project/_/settings/api")
    throw new Error("Missing Supabase environment variables. Please check .env.local file.")
  }

  if (supabaseUrl.includes("your_") || supabaseAnonKey.includes("your_")) {
    console.error("❌ Supabase environment variables are not configured!")
    console.error("Please replace the placeholder values in .env.local with your actual Supabase credentials.")
    throw new Error("Supabase environment variables are not configured. Please update .env.local file.")
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
