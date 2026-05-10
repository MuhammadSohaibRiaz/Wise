"use client"

import { useEffect, useState } from "react"
import type { Metadata } from "next"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Star, Loader2, MessageSquare } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface Review {
  id: string
  rating: number
  comment: string | null
  created_at: string
  case: {
    id: string
    title: string
  } | null
  lawyer: {
    id: string
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
  } | null
}

interface PendingReview {
  case_id: string
  case_title: string
  lawyer_id: string
  lawyer_name: string
  lawyer_avatar: string | null
  completed_at: string
}

export default function ReviewsPage() {
  const [submittedReviews, setSubmittedReviews] = useState<Review[]>([])
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        setIsLoading(true)
        const supabase = createClient()

        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user?.id) {
          toast({
            title: "Error",
            description: "You must be logged in to view reviews",
            variant: "destructive",
          })
          return
        }

        // Fetch submitted reviews
        const { data: reviewsData, error: reviewsError } = await supabase
          .from("reviews")
          .select(`
            id,
            rating,
            comment,
            created_at,
            case:cases!reviews_case_id_fkey (
              id,
              title
            ),
            lawyer:profiles!reviews_lawyer_id_fkey (
              id,
              first_name,
              last_name,
              avatar_url
            )
          `)
          .eq("client_id", session.user.id)
          .order("created_at", { ascending: false })

        if (reviewsError) throw reviewsError

        setSubmittedReviews(reviewsData || [])

        // Fetch completed cases without reviews (pending reviews)
        const { data: casesData, error: casesError } = await supabase
          .from("cases")
          .select(`
            id,
            title,
            updated_at,
            lawyer_id,
            lawyer:profiles!cases_lawyer_id_fkey (
              id,
              first_name,
              last_name,
              avatar_url
            )
          `)
          .eq("client_id", session.user.id)
          .eq("status", "completed")

        if (casesError) throw casesError

        // Filter out cases that already have reviews
        const reviewedCaseIds = new Set((reviewsData || []).map(r => r.case?.id))
        const pending = (casesData || [])
          .filter(c => !reviewedCaseIds.has(c.id) && c.lawyer)
          .map(c => ({
            case_id: c.id,
            case_title: c.title,
            lawyer_id: c.lawyer_id,
            lawyer_name: `${c.lawyer.first_name || ""} ${c.lawyer.last_name || ""}`.trim(),
            lawyer_avatar: c.lawyer.avatar_url,
            completed_at: c.updated_at,
          }))

        setPendingReviews(pending)
      } catch (error) {
        console.error("Error fetching reviews:", error)
        toast({
          title: "Error",
          description: "Failed to load reviews",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchReviews()
  }, [toast])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${i < rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
          }`}
      />
    ))
  }

  if (isLoading) {
    return (
      <main className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </main>
    )
  }

  return (
    <main className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Reviews</h1>
        <p className="text-muted-foreground mt-2">Share your experience with lawyers</p>
      </div>

      {/* Pending Reviews */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Pending Reviews</h2>

        {pendingReviews.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No pending reviews</p>
              <p className="text-sm text-muted-foreground">Complete a case to leave a review</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {pendingReviews.map((item) => (
              <Card key={item.case_id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarImage src={item.lawyer_avatar || undefined} />
                        <AvatarFallback>{item.lawyer_name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{item.lawyer_name}</p>
                        <p className="text-sm text-muted-foreground">{item.case_title}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Completed {formatDate(item.completed_at)}
                        </p>
                      </div>
                    </div>
                    <Button>Leave Review</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Submitted Reviews */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Your Reviews</h2>

        {submittedReviews.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Star className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No reviews yet</p>
              <p className="text-sm text-muted-foreground">Your submitted reviews will appear here</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {submittedReviews.map((review) => (
              <Card key={review.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <Avatar>
                      <AvatarImage src={review.lawyer?.avatar_url || undefined} />
                      <AvatarFallback>
                        {review.lawyer?.first_name?.charAt(0) || "L"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-medium">
                            {review.lawyer?.first_name} {review.lawyer?.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground">{review.case?.title}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(review.created_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mb-2">
                        {renderStars(review.rating)}
                      </div>
                      {review.comment && (
                        <p className="text-sm text-muted-foreground">{review.comment}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
