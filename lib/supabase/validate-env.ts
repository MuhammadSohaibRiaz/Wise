/**
 * Validates that required Supabase environment variables are set
 * Call this at the start of your app or in a utility function
 */

export function validateSupabaseEnv() {
  const requiredVars = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }

  const missing: string[] = []

  for (const [key, value] of Object.entries(requiredVars)) {
    if (!value || value.trim() === "" || value.includes("your_") || value.includes("_here")) {
      missing.push(key)
    }
  }

  if (missing.length > 0) {
    const errorMessage = `
⚠️  MISSING SUPABASE ENVIRONMENT VARIABLES ⚠️

The following environment variables are missing or not configured:
${missing.map((v) => `  - ${v}`).join("\n")}

Please:
1. Create a .env.local file in the root directory
2. Add the required variables (see .env.local.example)
3. Restart your development server (npm run dev)

Get your Supabase credentials from:
https://app.supabase.com/project/_/settings/api
    `.trim()

    if (typeof window === "undefined") {
      // Server-side
      console.error(errorMessage)
    } else {
      // Client-side
      console.error(errorMessage)
    }

    return false
  }

  return true
}

// Validate on import (server-side only)
if (typeof window === "undefined") {
  validateSupabaseEnv()
}

