"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Circle, AlertCircle, ArrowRight, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

export function ProfileCompletionCard() {
  const [status, setStatus] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  const fetchStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) return

      // Reuse the logic from tools.ts but client-side
      const [profileRes, lawyerRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', session.user.id).single(),
        supabase.from('lawyer_profiles').select('*').eq('id', session.user.id).single()
      ])

      const profile = profileRes.data
      const lawyer = lawyerRes.data

      if (!profile) return

      const fields = [
        { label: 'Basic Info', key: 'first_name', done: !!profile.first_name },
        { label: 'Contact Number', key: 'phone', done: !!profile.phone },
        { label: 'Professional Bio', key: 'bio', done: !!profile.bio },
        { label: 'Specializations', key: 'specializations', done: lawyer?.specializations?.length > 0 },
        { label: 'Hourly Rate', key: 'hourly_rate', done: !!lawyer?.hourly_rate },
        { label: 'Experience', key: 'years_of_experience', done: !!lawyer?.years_of_experience },
        { label: 'Bar License #', key: 'bar_license_number', done: !!lawyer?.bar_license_number },
        { label: 'Verification Doc', key: 'license_file_url', done: !!lawyer?.license_file_url },
      ]

      const completedCount = fields.filter(f => f.done).length
      const percentage = Math.round((completedCount / fields.length) * 100)

      setStatus({
        fields,
        percentage,
        isComplete: percentage === 100
      })
    } catch (error) {
      console.error("[ProfileCompletion] Error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()

    // Subscribe to profile changes to refresh UI
    const channel = supabase
      .channel('profile-completion-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => fetchStatus()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lawyer_profiles' },
        () => fetchStatus()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="h-32 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!status || status.isComplete) return null

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            Complete Your Profile
          </CardTitle>
          <span className="text-sm font-bold text-primary">{status.percentage}%</span>
        </div>
        <CardDescription>
          A complete profile helps you rank higher in searches and builds trust with clients.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={status.percentage} className="h-2" />
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {status.fields.map((field: any) => (
            <div key={field.label} className="flex items-center gap-2 text-xs">
              {field.done ? (
                <CheckCircle2 className="h-3 w-3 text-green-500" />
              ) : (
                <Circle className="h-3 w-3 text-muted-foreground/30" />
              )}
              <span className={field.done ? "text-muted-foreground line-through" : "text-foreground font-medium"}>
                {field.label}
              </span>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <Button 
            size="sm" 
            variant="default" 
            className="gap-2"
            onClick={() => router.push('/lawyer/profile')}
          >
            Finish Setup
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
