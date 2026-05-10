import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { HeroHeader } from "@/components/header";
import Chatbot from "@/components/chatbot/chatbot";
import { organizationWebSiteSchema } from "@/lib/schema";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://plasmocode.com"),
  title: {
    default: "Plasmocode - Custom Software Development & Web Solutions Agency",
    template: "%s | Plasmocode",
  },
  description:
    "Custom software development agency specializing in web apps, eCommerce, DevOps & AI/ML solutions for business growth.",
  keywords: [
    "Plasmocode",
    "custom software development",
    "web development agency",
    "ecommerce development",
    "software development company",
    "AI ML solutions",
    "DevOps automation",
    "web application development",
    "enterprise software solutions",
    "digital transformation",
    "scalable software solutions",
    "React development",
    "Next.js development",
    "Node.js development",
    "Python development",
  ],
  authors: [{ name: "Plasmocode", url: "https://plasmocode.com" }],
  creator: "Plasmocode",
  publisher: "Plasmocode",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://plasmocode.com",
    title: "Plasmocode - Custom Software Development & Web Solutions",
    description:
      "Leading custom software development agency. Expert web applications, eCommerce platforms, DevOps, and AI/ML solutions for business growth.",
    siteName: "Plasmocode",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Plasmocode - Custom Software Development Agency",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Plasmocode - Custom Software Development Agency",
    description:
      "Expert custom software, web applications, eCommerce platforms, DevOps automation, and AI/ML solutions.",
    creator: "@plasmocode",
    images: ["/twitter-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  other: {
    "google-site-verification": "your-google-search-console-verification-code",
    "msvalidate.01": "your-bing-verification-code",
    "yandex-verification": "your-yandex-verification-code",
    "facebook-domain-verification": "your-facebook-domain-verification",
    "pinterest-site-verification": "your-pinterest-verification",
    rating: "general",
    referrer: "origin-when-cross-origin",
    "format-detection": "telephone=no",
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "Plasmocode",
    "application-name": "Plasmocode",
    "theme-color": "#0F172A",
    "color-scheme": "dark light",
  },
  alternates: {
    canonical: "https://plasmocode.com",
    languages: {
      "en-US": "https://plasmocode.com",
      "x-default": "https://plasmocode.com",
    },
  },
  verification: {
    google: "your-google-search-console-verification-code",
    // yandex: "your-yandex-verification-code",
    // bing: "your-bing-verification-code",
  },
  category: "Technology",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = organizationWebSiteSchema();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <link rel="icon" href="/favicon.ico" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/favicon.ico" />
        <link rel="manifest" href="/site.webmanifest" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <HeroHeader />
          {children}
          <Chatbot />
        </ThemeProvider>
      </body>
    </html>
  );
}
