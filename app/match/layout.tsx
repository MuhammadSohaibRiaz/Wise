import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Find Your Perfect Lawyer | WiseCase",
  description:
    "Search through our network of verified lawyers by specialization, location, rating, and hourly rate. Book a consultation today.",
  keywords: [
    "lawyer search",
    "find lawyer",
    "legal consultation",
    "lawyer booking",
    "verified lawyers",
    "legal services",
  ],
  openGraph: {
    title: "Find Your Perfect Lawyer | WiseCase",
    description: "Search through our network of verified lawyers and book a consultation today.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Find Your Perfect Lawyer | WiseCase",
    description: "Search through our network of verified lawyers and book a consultation today.",
  },
  alternates: {
    canonical: "/match",
  },
}

export default function MatchLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}

