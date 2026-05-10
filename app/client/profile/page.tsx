import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Client Profile — Smart Lawyer Booking System",
  description: "Edit your client profile (prototype UI).",
}

export default function ClientProfilePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 grid gap-6">
      <h1 className="text-2xl md:text-3xl font-semibold">Profile</h1>
      <form className="grid gap-4">
        <label className="grid gap-2">
          <span className="text-sm font-medium">Full name</span>
          <input className="rounded-md border px-3 py-2 text-sm" placeholder="Your name" />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium">City</span>
          <input className="rounded-md border px-3 py-2 text-sm" placeholder="e.g., Lahore" />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium">Preferred languages</span>
          <input className="rounded-md border px-3 py-2 text-sm" placeholder="e.g., English" />
        </label>
        <button className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">
          Save Profile
        </button>
      </form>
    </main>
  )
}
