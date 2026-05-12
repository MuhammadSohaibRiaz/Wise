"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { LawyerCard } from "@/components/lawyer/lawyer-card"
import { generateRecommendationReason } from "@/lib/ai/lawyer-matching"
import { LawyerFilters, type FilterState } from "@/components/lawyer/lawyer-filters"
import { useToast } from "@/hooks/use-toast"
import { Loader2, LayoutDashboard } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { normalizeLawyerAverageRating } from "@/lib/lawyer-rating"

interface LawyerProfile {
  id: string
  first_name: string
  last_name: string
  avatar_url: string | null
  bio: string | null
  location: string | null
  availability_status: string | null
  specializations: string[]
  average_rating: number
  total_cases: number
  hourly_rate: number
  response_time_hours: number
  verified: boolean
  is_profile_active: boolean
}

function filtersFromSearchParams(searchParams: URLSearchParams): Partial<FilterState> {
  const spec =
    searchParams.get("specialization") ||
    searchParams.get("specializations") ||
    searchParams.get("caseType") ||
    ""
  const location = searchParams.get("location") || ""
  const search = searchParams.get("q") || searchParams.get("search") || ""
  const minRating = Number.parseFloat(searchParams.get("minRating") || "0") || 0
  const maxRate = Number.parseFloat(searchParams.get("maxRate") || "500") || 500
  const out: Partial<FilterState> = {
    location: location ? decodeURIComponent(location) : "",
    search: search ? decodeURIComponent(search) : "",
    minRating,
    maxRate,
  }
  const decodedSpec = spec.trim() ? decodeURIComponent(spec.trim()) : ""
  if (decodedSpec) {
    out.specializations = [decodedSpec]
  }
  return out
}

function MatchPageInner() {
  const searchParams = useSearchParams()
  const urlFilters = filtersFromSearchParams(searchParams)

  const [lawyers, setLawyers] = useState<LawyerProfile[]>([])
  const [filteredLawyers, setFilteredLawyers] = useState<LawyerProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [filters, setFilters] = useState<FilterState>({
    search: urlFilters.search ?? "",
    specializations: urlFilters.specializations ?? [],
    minRating: urlFilters.minRating ?? 0,
    maxRate: urlFilters.maxRate ?? 500,
    availability: null,
    location: urlFilters.location ?? "",
  })
  const { toast } = useToast()

  // Keep filters in sync when query string changes (e.g. from ai-recommendations link).
  useEffect(() => {
    const next = filtersFromSearchParams(searchParams)
    setFilters((prev) => ({
      ...prev,
      ...next,
      specializations: next.specializations ?? prev.specializations,
      location: next.location ?? prev.location,
      search: next.search ?? prev.search,
      minRating: next.minRating ?? prev.minRating,
      maxRate: next.maxRate ?? prev.maxRate,
    }))
  }, [searchParams])

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setIsAuthenticated(!!session)
    }
    checkAuth()
  }, [])

  useEffect(() => {
    const fetchLawyers = async () => {
      try {
        setIsLoading(true)
        const supabase = createClient()

        let { data, error } = await supabase
          .from("profiles")
          .select(
            `
            id,
            first_name,
            last_name,
            avatar_url,
            bio,
            location,
            availability_status,
            lawyer_profiles (
              specializations,
              average_rating,
              total_cases,
              hourly_rate,
              response_time_hours,
              verified,
              is_profile_active
            )
          `,
          )
          .eq("user_type", "lawyer")

        if (error || !data || data.length === 0) {
          const { data: profilesData, error: profilesError } = await supabase
            .from("profiles")
            .select("id, first_name, last_name, avatar_url, bio, location, availability_status")
            .eq("user_type", "lawyer")

          if (profilesError) {
            error = profilesError
            data = null
          } else {
            data = profilesData
            if (data && data.length > 0) {
              const lawyerIds = data.map((p: any) => p.id)
              const { data: lawyerProfilesData } = await supabase.from("lawyer_profiles").select("*").in("id", lawyerIds)

              data = data.map((profile: any) => {
                const matchingProfile = lawyerProfilesData?.find((lp: any) => lp.id === profile.id)
                return {
                  ...profile,
                  lawyer_profiles: matchingProfile ? [matchingProfile] : [],
                }
              })
            }
          }
        }

        if (error) {
          toast({
            title: "Error",
            description: `Failed to load lawyers: ${error.message}`,
            variant: "destructive",
          })
          return
        }

        const lawyersData = (data || [])
          .filter((lawyer: any) => {
            const profile = Array.isArray(lawyer.lawyer_profiles) ? lawyer.lawyer_profiles[0] : lawyer.lawyer_profiles
            return !profile || profile.is_profile_active !== false
          })
          .map((lawyer: any) => {
            const profile = Array.isArray(lawyer.lawyer_profiles) ? lawyer.lawyer_profiles[0] : lawyer.lawyer_profiles

            return {
              id: lawyer.id,
              first_name: lawyer.first_name || "",
              last_name: lawyer.last_name || "",
              avatar_url: lawyer.avatar_url,
              bio: lawyer.bio,
              location: lawyer.location,
              availability_status: lawyer.availability_status || "available",
              specializations: profile?.specializations || [],
              average_rating: normalizeLawyerAverageRating(profile?.average_rating),
              total_cases: profile?.total_cases != null ? Number(profile.total_cases) : 0,
              hourly_rate: profile?.hourly_rate != null ? Number(profile.hourly_rate) : 0,
              response_time_hours: profile?.response_time_hours != null ? Number(profile.response_time_hours) : 24,
              verified: profile?.verified === true,
              is_profile_active: profile?.is_profile_active !== false,
            }
          })

        setLawyers(lawyersData)
        setFilteredLawyers(lawyersData)
      } catch {
        toast({
          title: "Error",
          description: "An unexpected error occurred.",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchLawyers()
  }, [toast])

  useEffect(() => {
    let result = lawyers

    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      result = result.filter(
        (lawyer) =>
          `${lawyer.first_name} ${lawyer.last_name}`.toLowerCase().includes(searchLower) ||
          lawyer.bio?.toLowerCase().includes(searchLower),
      )
    }

    if (filters.location) {
      const loc = filters.location.toLowerCase()
      result = result.filter(
        (lawyer) => lawyer.location?.toLowerCase().includes(loc) || loc === "online",
      )
    }

    if (filters.specializations.length > 0) {
      result = result.filter((lawyer) =>
        filters.specializations.some((spec) =>
          lawyer.specializations.some((s: string) => {
            const a = s.toLowerCase()
            const b = spec.toLowerCase()
            return a.includes(b) || b.includes(a)
          }),
        ),
      )
    }

    if (filters.minRating > 0) {
      result = result.filter((lawyer) => lawyer.average_rating >= filters.minRating)
    }

    if (filters.maxRate < 500) {
      result = result.filter((lawyer) => lawyer.hourly_rate <= filters.maxRate)
    }

    if (filters.availability) {
      result = result.filter((lawyer) => lawyer.availability_status === filters.availability)
    }

    setFilteredLawyers(result)
  }, [lawyers, filters])

  const hasActiveUrlFilters =
    urlFilters.specializations?.length ||
    urlFilters.location ||
    urlFilters.search ||
    (urlFilters.minRating ?? 0) > 0 ||
    (urlFilters.maxRate ?? 500) < 500

  return (
    <>
      <main className="min-h-screen bg-background py-8 px-4">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2 text-balance">Find Your Perfect Lawyer</h1>
              <p className="text-lg text-muted-foreground">
                Search through our network of verified lawyers and book a consultation today.
              </p>
              {hasActiveUrlFilters && (
                <p className="text-sm text-muted-foreground mt-2">
                  Showing lawyers matching your filters from the URL. Adjust checkboxes on the left to refine further.
                </p>
              )}
            </div>
            {isAuthenticated && (
              <Link href="/client/dashboard">
                <Button variant="outline" className="gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  Go to Dashboard
                </Button>
              </Link>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1">
              <LawyerFilters
                key={searchParams.toString()}
                onFilterChange={setFilters}
                isLoading={isLoading}
                initialFilters={urlFilters}
              />
            </div>

            <div className="lg:col-span-3">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredLawyers.length === 0 ? (
                <div className="text-center py-16 rounded-lg border border-border bg-card p-8">
                  <p className="text-lg text-muted-foreground mb-2">No lawyers match these filters</p>
                  <p className="text-sm text-muted-foreground">
                    Try widening specialization or location, or clear filters on the left.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Found {filteredLawyers.length} lawyer{filteredLawyers.length !== 1 ? "s" : ""}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredLawyers.map((lawyer) => (
                      <LawyerCard
                        key={lawyer.id}
                        id={lawyer.id}
                        name={`${lawyer.first_name} ${lawyer.last_name}`}
                        avatar_url={lawyer.avatar_url}
                        bio={lawyer.bio}
                        specializations={lawyer.specializations}
                        average_rating={lawyer.average_rating}
                        total_cases={lawyer.total_cases}
                        location={lawyer.location}
                        hourly_rate={lawyer.hourly_rate}
                        response_time_hours={lawyer.response_time_hours}
                        verified={lawyer.verified}
                        availability_status={lawyer.availability_status}
                        recommendationReason={generateRecommendationReason({
                          specializations: lawyer.specializations,
                          rating: lawyer.average_rating,
                          caseType: filters.specializations[0] ?? null,
                          verified: lawyer.verified,
                          totalCases: lawyer.total_cases,
                        })}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}

export default function MatchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <MatchPageInner />
    </Suspense>
  )
}
