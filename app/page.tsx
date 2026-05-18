import type { Metadata } from "next"
import Link from "next/link"
import { Hero } from "@/components/sections/hero"
import { Features } from "@/components/sections/features"
import { ImageCarousel } from "@/components/sections/carousel"
import { SiteHeader } from "@/components/site-header"

export const metadata: Metadata = {
  title: "Smart Lawyer Booking System - AI-driven search, booking, and document analysis",
  description:
    "AI-based web platform to search lawyers by specialization/area, book appointments with availability, analyze legal documents via OCR/NLP, and pay securely.",
}

export default function HomePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "WiseCase",
    url: "https://wisecase.rapidnextech.com",
    description: "AI-driven lawyer search and booking with document analysis, legal RAG support, and secure payments.",
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />
      <Hero />
      <ImageCarousel />
      <section id="how-it-works" className="bg-background">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">How it works</p>
            <h2 className="mt-3 text-3xl font-semibold text-balance md:text-4xl">
              A predictable path from intake to consultation
            </h2>
          </div>
          <ol className="grid gap-4 md:grid-cols-3">
            <li className="rounded-lg border bg-card p-5">
              <h3 className="font-medium">1. Analyze or describe your case</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Start with document analysis or enter case details manually when booking a lawyer.
              </p>
            </li>
            <li className="rounded-lg border bg-card p-5">
              <h3 className="font-medium">2. Match with legal expertise</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Review lawyers by specialization, verification, reviews, pricing, and AI match reasons.
              </p>
            </li>
            <li className="rounded-lg border bg-card p-5">
              <h3 className="font-medium">3. Book, pay, and collaborate</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Schedule a consultation, pay securely, share case documents, and track the case lifecycle.
              </p>
            </li>
          </ol>
        </div>
      </section>
      <Features />
      <section id="get-started" className="bg-primary/5 py-24">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="mb-6 text-3xl font-extrabold tracking-tight md:text-5xl">
            Ready to simplify your legal journey?
          </h2>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
            Use WiseCase to find the right legal expertise, analyze documents with AI, and manage consultations in one place.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              href="/auth/client/register"
              className="inline-flex items-center justify-center rounded-full bg-primary px-10 py-4 text-lg font-bold text-primary-foreground shadow-xl shadow-primary/20 transition-all hover:shadow-primary/40 active:scale-95"
            >
              Get Started for Free
            </Link>
            <Link
              href="/auth/lawyer/sign-in"
              className="inline-flex items-center justify-center rounded-full border-2 border-slate-200 bg-white px-10 py-4 text-lg font-bold transition-all hover:bg-slate-50 active:scale-95 dark:border-slate-800 dark:bg-slate-900"
            >
              Join as a Lawyer
            </Link>
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
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
