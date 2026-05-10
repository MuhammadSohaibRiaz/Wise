export const dynamic = "force-dynamic"

import type { Metadata } from "next"
import { LawyerDashboardHeader } from "@/components/lawyer/dashboard-header"
import { LawyerCertificates } from "@/components/lawyer/certificates"
import { ProfileCompletionCard } from "@/components/lawyer/profile-completion-card"
import { LawyerManagementHub } from "@/components/lawyer/management-hub"
import { CaseStudies } from "@/components/lawyer/case-studies"
import { ClientTestimonials } from "@/components/lawyer/testimonials"
import { VerificationNotice } from "@/components/lawyer/verification-notice"

export const metadata: Metadata = {
  title: "Lawyer Dashboard — Smart Lawyer Booking System",
  description: "Manage your cases, client requests, and professional profile.",
}

export default function LawyerDashboard() {
  return (
    <div className="min-h-screen bg-background">
      <LawyerDashboardHeader />

      <div className="px-4 py-4 md:px-6 md:py-6 lg:px-8 max-w-7xl mx-auto">
        {/* Sidebar is provided by `app/lawyer/layout.tsx` — avoid duplicating it here */}
        <main className="space-y-6 md:space-y-8">
          <VerificationNotice />
          <ProfileCompletionCard />
          <LawyerManagementHub />
          <LawyerCertificates />
          <CaseStudies />
          <ClientTestimonials />
        </main>
      </div>
    </div>
  )
}
