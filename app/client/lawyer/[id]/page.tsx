"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Loader2, AlertCircle } from "lucide-react"
import { LawyerProfileHeader } from "@/components/lawyer/lawyer-profile-header"
import { LawyerCertifications } from "@/components/lawyer/lawyer-certifications"
import { LawyerReviews } from "@/components/lawyer/lawyer-reviews"
import { AvailabilityCalendar } from "@/components/lawyer/availability-calendar"
import { normalizeLawyerAverageRating } from "@/lib/lawyer-rating"

interface LawyerData {
  id: string
  first_name: string
  last_name: string
  avatar_url: string | null
  bio: string | null
  location: string | null
  email: string
  phone: string | null
  lawyer_profile: {
    specializations: string[]
    average_rating: number
    total_cases: number
    hourly_rate: number
    response_time_hours: number
    verified: boolean
    years_of_experience: number
    success_rate: number
    active_clients: number
    bio_extended: string | null
  }
  certifications: Array<{
    id: string
    title: string
    issuer: string
    issue_date?: string
    expiry_date?: string
    credential_id?: string
    credential_url?: string
  }>
}

export default function LawyerProfilePage() {
  const params = useParams()
  const lawyerId = params.id as string
  const [lawyer, setLawyer] = useState<LawyerData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const fetchLawyerProfile = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const supabase = createClient()

        const { data, error: fetchError } = await supabase
          .from("profiles")
          .select(`
            id,
            first_name,
            last_name,
            avatar_url,
            bio,
            location,
            email,
            phone,
            lawyer_profiles (
              specializations,
              average_rating,
              total_cases,
              hourly_rate,
              response_time_hours,
              verified,
              years_of_experience,
              success_rate,
              active_clients,
              bio_extended,
              total_earnings
            ),
            certifications (
              id,
              title,
              issuer,
              issue_date,
              expiry_date,
              credential_id,
              credential_url
            )
          `)
          .eq("id", lawyerId)
          .eq("user_type", "lawyer")
          .single()

        if (fetchError) {
          console.error("[v0] Fetch error:", fetchError)
          setError("Failed to load lawyer profile")
          toast({
            title: "Error",
            description: "Failed to load lawyer profile. Please try again.",
            variant: "destructive",
          })
          return
        }

        if (!data) {
          setError("Lawyer not found")
          toast({
            title: "Error",
            description: "Lawyer not found",
            variant: "destructive",
          })
          return
        }

        // Handle both array and object formats for lawyer_profiles
        const lawyerProfile = Array.isArray(data.lawyer_profiles)
          ? data.lawyer_profiles[0]
          : data.lawyer_profiles

        console.log("[v0] Lawyer profile data:", {
          rawData: data,
          lawyerProfile: lawyerProfile,
          hourly_rate: lawyerProfile?.hourly_rate,
          average_rating: lawyerProfile?.average_rating,
          total_cases: lawyerProfile?.total_cases,
          years_of_experience: lawyerProfile?.years_of_experience,
          success_rate: lawyerProfile?.success_rate,
        })

        if (!lawyerProfile) {
          console.warn("[v0] Lawyer profile found but lawyer_profiles record is missing for lawyer:", lawyerId)
        }

        setLawyer({
          ...data,
          lawyer_profile: lawyerProfile
            ? {
                specializations: lawyerProfile.specializations || [],
                // Convert to numbers, handling null/undefined - use actual values from DB
                average_rating: normalizeLawyerAverageRating(lawyerProfile.average_rating),
                total_cases: lawyerProfile.total_cases != null ? Number(lawyerProfile.total_cases) : 0,
                hourly_rate: lawyerProfile.hourly_rate != null ? Number(lawyerProfile.hourly_rate) : 0,
                response_time_hours: lawyerProfile.response_time_hours != null ? Number(lawyerProfile.response_time_hours) : 24,
                verified: lawyerProfile.verified === true,
                years_of_experience: lawyerProfile.years_of_experience != null ? Number(lawyerProfile.years_of_experience) : 0,
                success_rate: lawyerProfile.success_rate != null ? Number(lawyerProfile.success_rate) : 0,
                active_clients: lawyerProfile.active_clients != null ? Number(lawyerProfile.active_clients) : 0,
                bio_extended: lawyerProfile.bio_extended || null,
                total_earnings: lawyerProfile.total_earnings != null ? Number(lawyerProfile.total_earnings) : 0,
              }
            : {
                specializations: [],
                average_rating: 0,
                total_cases: 0,
                hourly_rate: 0,
                response_time_hours: 24,
                verified: false,
                years_of_experience: 0,
                success_rate: 0,
                active_clients: 0,
                bio_extended: null,
              },
          certifications: data.certifications || [],
        })
      } catch (error) {
        console.error("[v0] Unexpected error:", error)
        setError("An unexpected error occurred")
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    if (lawyerId) {
      fetchLawyerProfile()
    }
  }, [lawyerId, toast])

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background py-8 px-4">
        <div className="mx-auto max-w-4xl flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </main>
    )
  }

  if (error || !lawyer) {
    return (
      <main className="min-h-screen bg-background py-8 px-4">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 flex gap-4">
            <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0" />
            <div>
              <h2 className="font-semibold text-red-900 mb-1">Error</h2>
              <p className="text-sm text-red-700">{error || "Unable to load lawyer profile"}</p>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background py-8 px-4">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Header */}
        <LawyerProfileHeader
          id={lawyer.id}
          name={`${lawyer.first_name} ${lawyer.last_name}`}
          avatar_url={lawyer.avatar_url}
          bio={lawyer.bio}
          specializations={lawyer.lawyer_profile.specializations || []}
          average_rating={lawyer.lawyer_profile.average_rating || 0}
          total_cases={lawyer.lawyer_profile.total_cases || 0}
          location={lawyer.location}
          hourly_rate={lawyer.lawyer_profile.hourly_rate || 0}
          response_time_hours={lawyer.lawyer_profile.response_time_hours || 24}
          verified={lawyer.lawyer_profile.verified || false}
          years_of_experience={lawyer.lawyer_profile.years_of_experience || 0}
          success_rate={lawyer.lawyer_profile.success_rate || 0}
          active_clients={lawyer.lawyer_profile.active_clients || 0}
          total_earnings={lawyer.lawyer_profile.total_earnings || 0}
        />

        {/* Extended Bio */}
        {lawyer.lawyer_profile.bio_extended && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground">About</h2>
            <p className="text-base text-muted-foreground leading-relaxed">{lawyer.lawyer_profile.bio_extended}</p>
          </div>
        )}

        {/* Contact Info */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-xl font-bold text-foreground mb-4">Contact Information</h2>
          <div className="space-y-2">
            <p className="text-sm">
              <span className="font-medium text-foreground">Email:</span>{" "}
              <a href={`mailto:${lawyer.email}`} className="text-primary hover:underline">
                {lawyer.email}
              </a>
            </p>
            {lawyer.phone && (
              <p className="text-sm">
                <span className="font-medium text-foreground">Phone:</span>{" "}
                <a href={`tel:${lawyer.phone}`} className="text-primary hover:underline">
                  {lawyer.phone}
                </a>
              </p>
            )}
          </div>
        </div>

        {/* Certifications */}
        {lawyer.certifications && lawyer.certifications.length > 0 && (
          <LawyerCertifications certifications={lawyer.certifications} />
        )}

        {/* Availability Calendar */}
        <AvailabilityCalendar lawyerId={lawyer.id} />

        {/* Reviews */}
        <LawyerReviews lawyerId={lawyer.id} />
      </div>
    </main>
  )
}
