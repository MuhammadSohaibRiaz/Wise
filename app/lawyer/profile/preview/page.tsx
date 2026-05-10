"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Loader2, AlertCircle, ArrowLeft } from "lucide-react"
import { LawyerProfileHeader } from "@/components/lawyer/lawyer-profile-header"
import { LawyerCertifications } from "@/components/lawyer/lawyer-certifications"
import { LawyerReviews } from "@/components/lawyer/lawyer-reviews"
import { AvailabilityCalendar } from "@/components/lawyer/availability-calendar"
import { Button } from "@/components/ui/button"

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
    credential_url?: string
  }>
}

export default function LawyerProfilePreviewPage() {
  const router = useRouter()
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
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.push("/auth/lawyer/sign-in")
          return
        }

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
          .eq("id", user.id)
          .eq("user_type", "lawyer")
          .single()

        if (fetchError) {
          console.error("[Profile Preview] Fetch error:", fetchError)
          setError("Failed to load your profile")
          toast({
            title: "Error",
            description: "Failed to load your profile. Please try again.",
            variant: "destructive",
          })
          return
        }

        if (!data) {
          setError("Profile not found")
          return
        }

        setLawyer({
          id: data.id,
          first_name: data.first_name,
          last_name: data.last_name,
          avatar_url: data.avatar_url,
          bio: data.bio,
          location: data.location,
          email: data.email,
          phone: data.phone,
          lawyer_profile: (data.lawyer_profiles as any) || {
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
          certifications: (data.certifications as any) || [],
        })
      } catch (error) {
        console.error("[Profile Preview] Error:", error)
        setError("An unexpected error occurred")
      } finally {
        setIsLoading(false)
      }
    }

    fetchLawyerProfile()
  }, [router, toast])

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background py-8 px-4">
        <div className="mx-auto max-w-4xl flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </main>
    )
  }

  if (error || !lawyer) {
    return (
      <main className="min-h-screen bg-background py-8 px-4">
        <div className="mx-auto max-w-4xl">
          <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
            <div>
              <h2 className="font-semibold text-red-900">Error</h2>
              <p className="text-sm text-red-700">{error || "Profile not found"}</p>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background py-8 px-4">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Preview Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Public Profile Preview</h1>
            <p className="text-sm text-muted-foreground mt-1">
              This is how clients see your profile. No edit options are available in preview mode.
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push("/lawyer/profile")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Edit
          </Button>
        </div>

        {/* Profile Header */}
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
            <h2 className="text-2xl font-bold">About</h2>
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

