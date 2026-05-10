"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Star, Loader2, Quote } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface Review {
  id: string
  rating: number
  comment: string
  created_at: string
  reviewer: {
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
    bio: string | null
  } | null
}

export function ClientTestimonials() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user?.id) return

        const { data, error } = await supabase
          .from("reviews")
          .select(`
            id,
            rating,
            comment,
            created_at,
            reviewer:profiles!reviews_reviewer_id_fkey (
              first_name,
              last_name,
              avatar_url,
              bio
            )
          `)
          .eq("reviewee_id", session.user.id)
          .eq("status", "published")
          .order("created_at", { ascending: false })
          .limit(6)

        if (error) throw error
        setReviews(data || [])
      } catch (error) {
        console.error("[Testimonials] Error:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchReviews()
  }, [])

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Client Testimonials</h2>
        <p className="text-sm text-muted-foreground">{reviews.length} reviews published</p>
      </div>

      {reviews.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <Quote className="h-8 w-8 mx-auto text-muted-foreground/20 mb-3" />
          <p className="text-muted-foreground text-sm">No reviews yet. Reviews from completed cases will appear here once published.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reviews.map((review) => {
            const name = `${review.reviewer?.first_name || "Client"} ${review.reviewer?.last_name || ""}`.trim()
            const initials = `${review.reviewer?.first_name?.charAt(0) || "C"}${review.reviewer?.last_name?.charAt(0) || ""}`
            
            return (
              <Card key={review.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={review.reviewer?.avatar_url || "/placeholder.svg"} />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-sm">{name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(review.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex gap-0.5 mb-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star 
                      key={i} 
                      className={`h-3 w-3 ${i < review.rating ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground/30"}`} 
                    />
                  ))}
                </div>

                <p className="text-sm text-muted-foreground italic line-clamp-4">
                  "{review.comment || "No comment provided."}"
                </p>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
