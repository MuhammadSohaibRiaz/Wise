import type { Metadata } from "next"
import { Hero } from "@/components/sections/hero"
import { Features } from "@/components/sections/features"
import { ImageCarousel } from "@/components/sections/carousel"
import { SiteHeader } from "@/components/site-header"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Smart Lawyer Booking System — AI-driven search, booking, and document analysis",
  description:
    "AI-based web platform to search lawyers by specialization/area, book appointments with availability, analyze legal documents via OCR/NLP, and pay securely.",
}

export default function HomePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Smart Lawyer Booking System",
    url: "https://example.com",
    description: "AI-driven lawyer search and booking with OCR/NLP document analysis and secure payments.",
  }
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />
      <Hero />
      <ImageCarousel />
      <section id="how-it-works" className="bg-background">
        <div className="mx-auto max-w-6xl px-4 py-16 grid gap-8">
          <h2 className="text-3xl md:text-4xl font-semibold text-balance">How it works</h2>
          <ol className="grid gap-4 md:grid-cols-3">
            <li className="rounded-lg border p-4">
              <h3 className="font-medium">1) Search & Filter</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Find attorneys by specialization, area, and reviews with advanced filters.
              </p>
            </li>
            <li className="rounded-lg border p-4">
              <h3 className="font-medium">2) Upload & Analyze</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Upload legal documents for AI‑driven text extraction, summaries, risk analysis, and legal term
                extraction.
              </p>
            </li>
            <li className="rounded-lg border p-4">
              <h3 className="font-medium">3) Book & Pay</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Book appointments with availability tracking and pay securely (e.g., Stripe).
              </p>
            </li>
          </ol>
        </div>
      </section>
      <Features />
      <section id="get-started" className="bg-primary/5 py-24">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-6">
            Ready to simplify your legal journey?
          </h2>
          <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
            Join hundreds of clients who use WiseCase to find the right legal expertise and analyze documents with AI.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/auth/client/register"
              className="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground px-10 py-4 text-lg font-bold shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all active:scale-95"
            >
              Get Started for Free
            </Link>
            <Link
              href="/auth/lawyer/sign-in"
              className="inline-flex items-center justify-center rounded-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 px-10 py-4 text-lg font-bold hover:bg-slate-50 transition-all active:scale-95"
            >
              Join as a Lawyer
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            By proceeding you agree to our{" "}
            <a href="/terms" className="underline">
              Terms
            </a>{" "}
            and{" "}
            <a href="/privacy" className="underline">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </section>
    </>
  )
}
