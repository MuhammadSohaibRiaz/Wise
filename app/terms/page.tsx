import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Terms of Service — Smart Lawyer Booking System",
  description: "Terms page placeholder for the academic prototype.",
}

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 grid gap-6">
      <h1 className="text-2xl md:text-3xl font-semibold">Terms of Service</h1>
      <p className="text-sm text-muted-foreground">
        This page is a placeholder to support the prototype navigation. It reflects the academic nature of the project
        as described in the proposal and does not constitute legal advice.
      </p>
    </main>
  )
}
