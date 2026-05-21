
import type React from "react"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import "./globals.css"

import type { Metadata } from "next"
import { ThemeProvider } from "@/components/theme-provider"
import { LegalRagLauncher } from "@/components/rag/legal-rag-launcher"
import { Toaster } from "@/components/ui/toaster"
import { NotificationToastListener } from "@/components/notifications/notification-toast-listener"
import { RootProgressBar } from "@/components/root-progress"
import { OAuthCallbackHashRedirect } from "@/components/auth/oauth-callback-hash-redirect"

export const metadata: Metadata = {
  title: {
    default: "WiseCase - Smart Lawyer Booking System",
    template: "%s | WiseCase",
  },
  description:
    "AI-driven web-based platform to search lawyers, book appointments, analyze case documents with OCR/NLP, and pay securely.",
  keywords: [
    "Lawyer Booking",
    "AI recommendation",
    "OCR",
    "NLP",
    "Legal document analysis",
    "Stripe payments",
    "legal consultation",
    "lawyer search",
    "case management",
  ],
  authors: [{ name: "WiseCase" }],
  creator: "WiseCase",
  publisher: "WiseCase",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  icons: {
    icon: [{ url: "/wisecase-logo.png", type: "image/png" }],
    shortcut: "/wisecase-logo.png",
    apple: "/wisecase-logo.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    title: "WiseCase - Smart Lawyer Booking System",
    description: "AI-driven web-based platform to search lawyers, book appointments, analyze case documents with OCR/NLP, and pay securely.",
    siteName: "WiseCase",
    images: [
      {
        url: "/wisecase-logo.png",
        width: 1200,
        height: 1200,
        alt: "WiseCase logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "WiseCase - Smart Lawyer Booking System",
    description: "AI-driven web-based platform to search lawyers, book appointments, analyze case documents with OCR/NLP, and pay securely.",
    images: ["/wisecase-logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable} antialiased`}>
        <ThemeProvider defaultTheme="system" enableSystem>
          <OAuthCallbackHashRedirect />
          <RootProgressBar />
          {children}
          <LegalRagLauncher />
          <Toaster />
          <NotificationToastListener />
        </ThemeProvider>
      </body>
    </html>
  )
}
