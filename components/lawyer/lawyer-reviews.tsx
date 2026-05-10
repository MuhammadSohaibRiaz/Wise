"use client"

import { Star, User } from "lucide-react"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"

interface Review {
  id: string
  rating: number
  comment: string
  created_at: string
  reviewer: {
    first_name: string
    last_name: string
    avatar_url?: string
  }
}

interface LawyerReviewsProps {
  lawyerId: string
}

export function LawyerReviews({ lawyerId }: LawyerReviewsProps) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        setIsLoading(true)
        const supabase = createClient()

        console.log("[v0] Fetching reviews for lawyer:", lawyerId)

        // First try simple query without join (more reliable)
        // RLS policy allows public access to published reviews
        const { data: reviewsData, error: reviewsError } = await supabase
          .from("reviews")
          .select("id, rating, comment, created_at, reviewer_id, status")
          .eq("reviewee_id", lawyerId)
          .eq("status", "published")
          .order("created_at", { ascending: false })
          .limit(10)

        if (reviewsError) {
          console.error("[v0] Error fetching reviews:", reviewsError)
          console.error("[v0] Review error details:", JSON.stringify(reviewsError, null, 2))
          
          // Try without status filter in case RLS is blocking
          console.log("[v0] Retrying without status filter...")
          const { data: allReviewsData, error: allReviewsError } = await supabase
            .from("reviews")
            .select("id, rating, comment, created_at, reviewer_id, status")
            .eq("reviewee_id", lawyerId)
            .order("created_at", { ascending: false })
            .limit(10)

          if (allReviewsError) {
            console.error("[v0] Alternative query also failed:", allReviewsError)
            setReviews([])
            return
          }

          // Filter to published reviews manually
          const publishedReviews = (allReviewsData || []).filter((r: any) => r.status === "published")
          console.log("[v0] Found reviews (after manual filter):", publishedReviews)
          
          if (publishedReviews.length === 0) {
            setReviews([])
            return
          }

          // Use the filtered reviews
          const reviewerIds = publishedReviews.map((r: any) => r.reviewer_id).filter(Boolean)
          
          if (reviewerIds.length > 0) {
            const { data: profilesData } = await supabase
              .from("profiles")
              .select("id, first_name, last_name, avatar_url")
              .in("id", reviewerIds)

            const reviewsWithProfiles = publishedReviews.map((review: any) => ({
              id: review.id,
              rating: review.rating,
              comment: review.comment,
              created_at: review.created_at,
              reviewer: profilesData?.find((p: any) => p.id === review.reviewer_id) || {
                first_name: "Anonymous",
                last_name: "",
              },
            }))

            console.log("[v0] Reviews with profiles (fallback):", reviewsWithProfiles)
            setReviews(reviewsWithProfiles)
          } else {
            setReviews([])
          }
          return
        }

        console.log("[v0] Reviews fetched (raw):", reviewsData)
        console.log("[v0] Number of reviews:", reviewsData?.length || 0)

        // Manually fetch reviewer profiles
        if (reviewsData && reviewsData.length > 0) {
          const reviewerIds = reviewsData.map((r: any) => r.reviewer_id).filter(Boolean)
          console.log("[v0] Reviewer IDs:", reviewerIds)
          
          if (reviewerIds.length > 0) {
            const { data: profilesData, error: profilesError } = await supabase
              .from("profiles")
              .select("id, first_name, last_name, avatar_url")
              .in("id", reviewerIds)

            if (profilesError) {
              console.error("[v0] Error fetching reviewer profiles:", profilesError)
            }

            console.log("[v0] Reviewer profiles:", profilesData)

            const reviewsWithProfiles = reviewsData.map((review: any) => ({
              id: review.id,
              rating: review.rating,
              comment: review.comment,
              created_at: review.created_at,
              reviewer: profilesData?.find((p: any) => p.id === review.reviewer_id) || {
                first_name: "Anonymous",
                last_name: "",
              },
            }))

            console.log("[v0] Final reviews with profiles:", reviewsWithProfiles)
            setReviews(reviewsWithProfiles)
          } else {
            // No reviewer IDs, create anonymous reviews
            const anonymousReviews = reviewsData.map((review: any) => ({
              id: review.id,
              rating: review.rating,
              comment: review.comment,
              created_at: review.created_at,
              reviewer: {
                first_name: "Anonymous",
                last_name: "",
              },
            }))
            console.log("[v0] Anonymous reviews:", anonymousReviews)
            setReviews(anonymousReviews)
          }
        } else {
          console.log("[v0] No reviews found for lawyer:", lawyerId)
          setReviews([])
        }
      } catch (error) {
        console.error("[v0] Unexpected error fetching reviews:", error)
        setReviews([])
      } finally {
        setIsLoading(false)
      }
    }

    if (lawyerId) {
      fetchReviews()
    }
  }, [lawyerId])

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!reviews || reviews.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No reviews yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-foreground">Client Reviews ({reviews.length})</h2>

      <div className="space-y-3">
        {reviews.map((review) => (
          <div key={review.id} className="rounded-lg border border-border bg-card p-4">
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">
                    {review.reviewer?.first_name} {review.reviewer?.last_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(review.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${
                      i < review.rating ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Comment */}
            {review.comment && <p className="text-sm text-muted-foreground line-clamp-3">{review.comment}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
