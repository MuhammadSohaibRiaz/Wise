import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy Policy — Smart Lawyer Booking System",
  description: "Privacy page placeholder for the academic prototype.",
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 grid gap-6">
      <h1 className="text-2xl md:text-3xl font-semibold">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground">
        This page is a placeholder to support the prototype navigation. It signifies that user data and legal documents
        are processed for demonstration purposes only, per proposal scope (English-language documents).
      </p>
    </main>
  )
}
