import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Client Documents — Smart Lawyer Booking System",
  description: "Manage your uploaded case documents (prototype UI).",
}

export default function ClientDocumentsPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 grid gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-semibold">Documents</h1>
        <a href="/client/analysis" className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm">
          Analyze new
        </a>
      </header>

      <div className="rounded-lg border p-4">
        <p className="text-sm text-muted-foreground">No documents uploaded yet. Upload from the Analyze page.</p>
      </div>
    </main>
  )
}
