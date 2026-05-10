"use client"

import { useState, useEffect } from "react"
import { Star, MapPin, Clock, Check, MessageCircle } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { BookAppointmentModal } from "@/components/lawyer/book-appointment-modal"
import { createClient } from "@/lib/supabase/client"
import { formatLawyerRatingLabel, normalizeLawyerAverageRating } from "@/lib/lawyer-rating"

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
  const [bookingOpen, setBookingOpen] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const getCurrentUser = async () => {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setUserId(session?.user?.id || null)
    }
    getCurrentUser()
  }, [])

  const handleBookClick = () => {
    if (!userId) {
      // Redirect to login if not authenticated
      window.location.href = "/auth/client/sign-in"
      return
    }
    setBookingOpen(true)
  }

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
              <div className="flex flex-col gap-2">
                <Button onClick={handleBookClick} className="w-full">
                  Book Appointment
                </Button>
                <a href={`/client/messages?lawyer=${id}`}>
                  <Button variant="outline" className="w-full bg-transparent">
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Message
                  </Button>
                </a>
              </div>
            </div>

            {/* Bio */}
            {bio && <p className="text-base text-muted-foreground mb-4 line-clamp-3">{bio}</p>}

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
                <p className="text-lg font-bold">{success_rate > 0 ? `${success_rate.toFixed(0)}%` : "N/A"}</p>
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
                    <p className="text-lg font-bold">${total_earnings.toLocaleString()}</p>
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

      {userId && (
        <BookAppointmentModal
          open={bookingOpen}
          onOpenChange={setBookingOpen}
          lawyerId={id}
          lawyerName={name}
          hourlyRate={hourly_rate}
          clientId={userId}
          onBookingSuccess={() => {
            // Redirect to appointments page after successful booking
            window.location.href = "/client/appointments"
          }}
        />
      )}
    </>
  )
}
