"use client"

import { useState, useEffect } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ShieldAlert, ShieldX, ShieldEllipsis, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

type VerificationStatus = "unverified" | "pending" | "approved" | "rejected"

export function VerificationNotice() {
  const [status, setStatus] = useState<VerificationStatus | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function checkStatus() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) return
      setUserId(session.user.id)

      const { data } = await supabase
        .from('lawyer_profiles')
        .select('verified, license_file_url, verification_status')
        .eq('id', session.user.id)
        .single()

      if (data) {
        if (data.verification_status === "rejected") {
          setStatus("rejected")
        } else if (data.verification_status === "approved" || data.verified) {
          setStatus("approved")
        } else if (data.license_file_url) {
          setStatus('pending')
        } else {
          setStatus('unverified')
        }
      }
      setIsLoading(false)
    }

    checkStatus()
    
    const channel = supabase
      .channel('verification-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lawyer_profiles', filter: userId ? `id=eq.${userId}` : undefined },
        () => checkStatus()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  if (isLoading || status === 'approved') return null

  return (
    <div className="mb-6">
      {status === 'unverified' ? (
        <Alert variant="destructive" className="bg-destructive/10 border-destructive/20">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle className="font-bold">Verification Required</AlertTitle>
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p>
              You haven't uploaded your professional license yet. Your profile will not be visible to clients until you are verified.
            </p>
            <Button 
              size="sm" 
              variant="destructive" 
              className="w-fit gap-2"
              onClick={() => router.push('/lawyer/profile?tab=professional&focus=license')}
            >
              Upload Now
              <ArrowRight className="h-4 w-4" />
            </Button>
          </AlertDescription>
        </Alert>
      ) : status === "pending" ? (
        <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/50">
          <ShieldEllipsis className="h-4 w-4 text-amber-600 dark:text-amber-500" />
          <AlertTitle className="text-amber-800 dark:text-amber-400 font-bold">Verification Pending</AlertTitle>
          <AlertDescription>
            Your license has been submitted and is under review. You will be notified as soon as it is approved or rejected.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert variant="destructive" className="bg-destructive/10 border-destructive/20">
          <ShieldX className="h-4 w-4" />
          <AlertTitle className="font-bold">Verification Rejected</AlertTitle>
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p>
              Your submitted license was rejected. Please upload a clearer or updated document to request verification again.
            </p>
            <Button
              size="sm"
              variant="destructive"
              className="w-fit gap-2"
              onClick={() => router.push('/lawyer/profile?tab=professional&focus=license')}
            >
              Re-upload Document
              <ArrowRight className="h-4 w-4" />
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
