import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Register — Smart Lawyer Booking System",
  description: "Create an account to manage your profile, documents, and appointments (prototype UI).",
}

export default function RegisterPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-10 grid gap-6">
      <h1 className="text-2xl md:text-3xl font-semibold">Register</h1>
      <form className="grid gap-4">
        <label className="grid gap-2">
          <span className="text-sm font-medium">Full name</span>
          <input className="rounded-md border px-3 py-2 text-sm" placeholder="Your name" />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium">Email</span>
          <input type="email" className="rounded-md border px-3 py-2 text-sm" placeholder="you@example.com" />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium">Password</span>
          <input type="password" className="rounded-md border px-3 py-2 text-sm" placeholder="••••••••" />
        </label>
        <button className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">
          Create Account
        </button>
      </form>
      <p className="text-xs text-muted-foreground">
        By registering you agree to our{" "}
        <a href="/terms" className="underline">
          Terms
        </a>{" "}
        and{" "}
        <a href="/privacy" className="underline">
          Privacy Policy
        </a>
        .
      </p>
    </main>
  )
}
