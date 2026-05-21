"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Star, MapPin, Clock, Check, MessageCircle } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { BookAppointmentModal } from "@/components/lawyer/book-appointment-modal"
import { createClient } from "@/lib/supabase/client"
import { formatLawyerRatingLabel, normalizeLawyerAverageRating } from "@/lib/lawyer-rating"
import { formatConsultationFeeBase, formatCurrency } from "@/lib/currency"
import { formatSuccessRateDisplay } from "@/lib/lawyer-success-rate-display"
import {
  BOOK_ON_PROFILE_QUERY,
  buildClientSignInToBookUrl,
  buildProfileBookReturnUrl,
} from "@/lib/auth/client-booking-return"

interface LawyerProfileHeaderProps {
  id: string
  name: string
  avatar_url: string | null
  bio: string | null
  specializations: string[]
  average_rating: number
  total_cases: number
  location: string | null
  hourly_rate: number
  response_time_hours: number
  verified: boolean
  years_of_experience: number
  success_rate: number
  active_clients: number
  total_earnings?: number
}

type CaseLinkState = "loading" | "none" | "active"

const ACTIVE_CLIENT_CASE_STATUSES = ["open", "in_progress", "pending_completion"] as const

export function LawyerProfileHeader({
  id,
  name,
  avatar_url,
  bio,
  specializations,
  average_rating,
  total_cases,
  location,
  hourly_rate,
  response_time_hours,
  verified,
  years_of_experience,
  success_rate,
  active_clients,
  total_earnings = 0,
}: LawyerProfileHeaderProps) {
  const ratingNorm = normalizeLawyerAverageRating(average_rating)
  const ratingLabel = formatLawyerRatingLabel(ratingNorm)
  const successDisplay = formatSuccessRateDisplay(total_cases, success_rate)
  const [bookingOpen, setBookingOpen] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [isClient, setIsClient] = useState(false)
  const [caseLinkState, setCaseLinkState] = useState<CaseLinkState>("loading")
  const router = useRouter()

  useEffect(() => {
    let cancelled = false

    const loadAuthAndCase = async () => {
      setCaseLinkState("loading")
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (cancelled) return

      const uid = session?.user?.id || null
      setUserId(uid)

      if (!uid) {
        setIsClient(false)
        setCaseLinkState("none")
        return
      }

      const { data: profile } = await supabase.from("profiles").select("user_type").eq("id", uid).maybeSingle()

      if (cancelled) return

      const clientUser = profile?.user_type === "client"
      setIsClient(clientUser)

      if (!clientUser) {
        setCaseLinkState("none")
        return
      }

      const { data: activeCase } = await supabase
        .from("cases")
        .select("id")
        .eq("client_id", uid)
        .eq("lawyer_id", id)
        .in("status", [...ACTIVE_CLIENT_CASE_STATUSES])
        .limit(1)
        .maybeSingle()

      if (cancelled) return

      setCaseLinkState(activeCase ? "active" : "none")
    }

    void loadAuthAndCase()

    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!userId || !isClient || typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    if (params.get(BOOK_ON_PROFILE_QUERY) !== "1") return
    setBookingOpen(true)
    params.delete(BOOK_ON_PROFILE_QUERY)
    const q = params.toString()
    router.replace(q ? `/client/lawyer/${id}?${q}` : `/client/lawyer/${id}`, { scroll: false })
  }, [userId, isClient, id, router])

  const handleBookClick = () => {
    if (!userId || !isClient) {
      router.push(buildClientSignInToBookUrl(buildProfileBookReturnUrl(id)))
      return
    }
    setBookingOpen(true)
  }

  const showSignedInClient = Boolean(userId && isClient)
  const showMessagingHelper = showSignedInClient && caseLinkState === "none"
  const showGoToMessages = showSignedInClient && caseLinkState === "active"

  return (
    <>
      <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg border border-border p-6 md:p-8">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <div className="relative h-32 w-32 rounded-lg overflow-hidden border-2 border-border">
              {avatar_url ? (
                <Image src={avatar_url || "/placeholder.svg"} alt={name} fill className="object-cover" priority />
              ) : (
                <div className="h-full w-full bg-muted flex items-center justify-center">
                  <span className="text-4xl font-bold text-muted-foreground">{name.charAt(0).toUpperCase()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-3xl md:text-4xl font-bold text-foreground">{name}</h1>
                  {verified && <Check className="h-6 w-6 text-green-500 flex-shrink-0" />}
                </div>
                <p className="text-lg text-muted-foreground mb-3">{years_of_experience}+ years of experience</p>
              </div>
              <div className="flex flex-col gap-2 min-w-[200px]">
                <Button onClick={handleBookClick} className="w-full">
                  {showSignedInClient ? "Book Consultation" : "Sign in to Book"}
                </Button>
                {showGoToMessages ? (
                  <Button variant="outline" className="w-full bg-transparent" asChild>
                    <Link href={`/client/messages?lawyer=${id}`}>
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Go to Messages
                    </Link>
                  </Button>
                ) : null}
                {showMessagingHelper ? (
                  <p className="text-xs text-muted-foreground text-center leading-snug px-1">
                    Book a consultation to start messaging once your request is accepted.
                  </p>
                ) : null}
              </div>
            </div>

            {/* Bio */}
            {bio && <p className="text-base text-muted-foreground mb-4 line-clamp-3">{bio}</p>}

            {hourly_rate > 0 && (
              <div className="mb-4 inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                Consultation Fee: {formatConsultationFeeBase(hourly_rate)}
              </div>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-background rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Star className="h-4 w-4 text-yellow-500" />
                  <span className="text-xs text-muted-foreground">Rating</span>
                </div>
                <p className="text-lg font-bold">
                  {ratingNorm > 0 ? `${ratingLabel}/5` : "No ratings"}
                </p>
              </div>
              <div className="bg-background rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Check className="h-4 w-4 text-blue-500" />
                  <span className="text-xs text-muted-foreground">Success</span>
                </div>
                <p className="text-lg font-bold">{successDisplay.label}</p>
              </div>
              <div className="bg-background rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-orange-500" />
                  <span className="text-xs text-muted-foreground">Response</span>
                </div>
                <p className="text-lg font-bold">{response_time_hours}h</p>
              </div>
              <div className="bg-background rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="h-4 w-4 text-green-500" />
                  <span className="text-xs text-muted-foreground">Cases</span>
                </div>
                <p className="text-lg font-bold">{total_cases}</p>
              </div>
            </div>

            {/* Additional Stats Row */}
            {(active_clients > 0 || total_earnings > 0 || years_of_experience > 0) && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
                {years_of_experience > 0 && (
                  <div className="bg-background rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Check className="h-4 w-4 text-purple-500" />
                      <span className="text-xs text-muted-foreground">Experience</span>
                    </div>
                    <p className="text-lg font-bold">{years_of_experience}+ years</p>
                  </div>
                )}
                {active_clients > 0 && (
                  <div className="bg-background rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <MessageCircle className="h-4 w-4 text-indigo-500" />
                      <span className="text-xs text-muted-foreground">Active Clients</span>
                    </div>
                    <p className="text-lg font-bold">{active_clients}</p>
                  </div>
                )}
                {total_earnings > 0 && (
                  <div className="bg-background rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Star className="h-4 w-4 text-green-500" />
                      <span className="text-xs text-muted-foreground">Total Earnings</span>
                    </div>
                    <p className="text-lg font-bold">{formatCurrency(total_earnings)}</p>
                  </div>
                )}
              </div>
            )}

            {/* Specializations */}
            {specializations && specializations.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium text-muted-foreground mb-2">Specializations</p>
                <div className="flex flex-wrap gap-2">
                  {specializations.map((spec) => (
                    <span
                      key={spec}
                      className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                    >
                      {spec}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {userId && isClient && (
        <BookAppointmentModal
          open={bookingOpen}
          onOpenChange={setBookingOpen}
          lawyerId={id}
          lawyerName={name}
          hourlyRate={hourly_rate}
          clientId={userId}
          onBookingSuccess={() => {
            window.location.href = "/client/appointments"
          }}
        />
      )}
    </>
  )
}
