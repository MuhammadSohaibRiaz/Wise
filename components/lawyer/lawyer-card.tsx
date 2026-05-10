"use client"

import { useState, useEffect } from "react"
import { Star, MapPin, Briefcase, Clock, Badge } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { BookAppointmentModal } from "@/components/lawyer/book-appointment-modal"
import { createClient } from "@/lib/supabase/client"
import { formatLawyerRatingLabel, normalizeLawyerAverageRating } from "@/lib/lawyer-rating"
import { markLatestDraftLawyerSelection } from "@/lib/case-drafts"

interface LawyerCardProps {
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
  availability_status: string | null
}

export function LawyerCard({
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
  availability_status,
}: LawyerCardProps) {
  const ratingDisplay = formatLawyerRatingLabel(normalizeLawyerAverageRating(average_rating))
  const [bookingOpen, setBookingOpen] = useState(false)
  const [clientId, setClientId] = useState<string | null>(null)

  useEffect(() => {
    const getCurrentUser = async () => {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setClientId(session?.user?.id || null)
    }
    getCurrentUser()
  }, [])

  const handleBookNow = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!clientId) {
      // Redirect to login if not authenticated
      window.location.href = "/auth/client/sign-in"
      return
    }
    const supabase = createClient()
    await markLatestDraftLawyerSelection(supabase, clientId, id)
    setBookingOpen(true)
  }

  return (
    <>
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm hover:shadow-md transition-shadow min-h-[420px] flex flex-col">
        {/* Header with Avatar and Name */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-4 flex-1">
            <div className="relative h-16 w-16 flex-shrink-0">
              {avatar_url ? (
                <Image src={avatar_url || "/placeholder.svg"} alt={name} fill className="rounded-full object-cover" />
              ) : (
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-2xl font-semibold text-muted-foreground">{name.charAt(0).toUpperCase()}</span>
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-foreground">{name}</h3>
                {verified && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Badge className="h-4 w-4" />
                    Verified
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">{bio || "No bio provided"}</p>
            </div>
          </div>
        </div>

        {/* Specializations */}
        {specializations && specializations.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2 leading-relaxed">
            {specializations.slice(0, 3).map((spec) => (
              <span
                key={spec}
                className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
              >
                {spec}
              </span>
            ))}
            {specializations.length > 3 && (
              <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                +{specializations.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4 pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-500" />
            <div>
              <p className="text-xs text-muted-foreground">Rating</p>
              <p className="text-sm font-semibold">
                {ratingDisplay === "New" ? "New" : `${ratingDisplay}/5`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">Cases</p>
              <p className="text-sm font-semibold">{total_cases || 0}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-green-500" />
            <div>
              <p className="text-xs text-muted-foreground">Location</p>
              <p className="text-sm font-semibold truncate">{location || "Online"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-orange-500" />
            <div>
              <p className="text-xs text-muted-foreground">Response</p>
              <p className="text-sm font-semibold">{response_time_hours || 24}h</p>
            </div>
          </div>
        </div>

        {/* Rate and CTA */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-muted-foreground">Hourly Rate</p>
            <p className="text-lg font-bold text-foreground">${hourly_rate?.toFixed(2) || "0"}</p>
          </div>
          {availability_status === "available" && (
            <span className="inline-flex items-center rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-700">
              Available Now
            </span>
          )}
        </div>

        {/* Spacer to push buttons to bottom */}
        <div className="flex-grow" />

        {/* Action Buttons */}
        <div className="flex gap-2 mt-auto">
          <Link href={`/client/lawyer/${id}`} className="flex-1">
            <Button variant="outline" className="w-full bg-transparent">
              View Profile
            </Button>
          </Link>
          <Button onClick={handleBookNow} className="flex-1 w-full">
            Book Now
          </Button>
        </div>
      </div>

      {clientId && (
        <BookAppointmentModal
          open={bookingOpen}
          onOpenChange={setBookingOpen}
          lawyerId={id}
          lawyerName={name}
          hourlyRate={Number(hourly_rate) || 0}
          clientId={clientId}
          onBookingSuccess={() => {
            // Redirect to appointments page after successful booking
            window.location.href = "/client/appointments"
          }}
        />
      )}
    </>
  )
}
