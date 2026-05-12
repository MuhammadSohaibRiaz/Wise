"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle, XCircle, ShieldCheck, User, Search, Filter, ExternalLink, AlertTriangle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AdminHeader } from "@/components/admin/admin-header"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"

interface PendingLawyer {
  id: string
  first_name: string
  last_name: string
  email: string
  avatar_url: string
  lawyer_profile: {
    bar_license_number: string
    years_of_experience: number
    specializations: string[]
    verified: boolean
    verification_status?: "pending" | "approved" | "rejected"
    license_file_url?: string
    ai_license_match?: boolean
    ai_extracted_license?: string
  }
}

const normalizeLawyerProfile = (profile: any): PendingLawyer["lawyer_profile"] | null => {
  if (!profile) return null
  if (Array.isArray(profile)) return profile[0] ?? null
  return profile
}

export default function AdminVerificationPage() {
  const [lawyers, setLawyers] = useState<PendingLawyer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    checkAdmin()
  }, [])

  const checkAdmin = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .single()

      if (profile?.user_type === "admin") {
        setIsAdmin(true)
        fetchPendingLawyers()
      } else {
        setIsAdmin(false)
        setIsLoading(false)
      }
    } catch (error) {
      console.error("Admin check error:", error)
      setIsLoading(false)
    }
  }

  const fetchPendingLawyers = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          id,
          first_name,
          last_name,
          email,
          avatar_url,
          lawyer_profile:lawyer_profiles!id (
            bar_license_number,
            years_of_experience,
            specializations,
            verified,
            verification_status,
            license_file_url,
            ai_license_match,
            ai_extracted_license
          )
        `)
        .eq("user_type", "lawyer")
        .eq("lawyer_profiles.verification_status", "pending")

      if (error) throw error

      // Filter out lawyers whose profiles might not exist yet or are already verified (redundant due to eq)
      const normalized = (data || [])
        .map((row: any) => {
          const lawyerProfile = normalizeLawyerProfile(row.lawyer_profile)
          if (!lawyerProfile) return null
          return {
            ...row,
            lawyer_profile: lawyerProfile,
          }
        })
        .filter((row: any) => row && row.lawyer_profile?.verification_status === "pending") as PendingLawyer[]
      setLawyers(normalized)
    } catch (error) {
      console.error("Fetch pending lawyers error:", error)
      toast({
        title: "Error",
        description: "Failed to load pending lawyers.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerify = async (lawyerId: string) => {
    try {
      setIsProcessing(lawyerId)

      const { error } = await supabase
        .from("lawyer_profiles")
        .update({
          verified: true,
          verification_status: "approved",
          verified_at: new Date().toISOString()
        })
        .eq("id", lawyerId)

      if (error) throw error

      try {
        const { recomputeLawyerTrustScore } = await import("@/lib/recompute-lawyer-trust")
        await recomputeLawyerTrustScore(supabase, lawyerId)
      } catch (e) {
        console.warn("[Admin] trust_score update skipped:", e)
      }

      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from("notifications").insert({
        user_id: lawyerId,
        created_by: user?.id ?? lawyerId,
        type: "system",
        title: "Verification Approved",
        description: "Your lawyer verification has been approved. Your profile is now visible to clients.",
        data: { verification_status: "approved" },
      })

      // Email notification sent to lawyer — see /api/notify/email
      fetch("/api/notify/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: "verification_approved", data: { lawyer_id: lawyerId } }),
      }).catch(() => {})

      setLawyers(lawyers.filter(l => l.id !== lawyerId))

      toast({
        title: "Lawyer Verified",
        description: "The lawyer has been successfully verified.",
      })
    } catch (error) {
      console.error("Verification error:", error)
      toast({
        title: "Error",
        description: "Failed to verify lawyer.",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(null)
    }
  }

  const handleReject = async (lawyerId: string) => {
    if (!confirm("Are you sure you want to reject this lawyer verification? The account will remain, but verification will be marked as rejected.")) return

    try {
      setIsProcessing(lawyerId)

      const { error } = await supabase
        .from("lawyer_profiles")
        .update({
          verified: false,
          verification_status: "rejected",
          verified_at: null,
        })
        .eq("id", lawyerId)

      if (error) throw error

      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from("notifications").insert({
        user_id: lawyerId,
        created_by: user?.id ?? lawyerId,
        type: "system",
        title: "Verification Rejected",
        description: "Your verification was rejected. Please review your profile and upload updated license documents to request another review.",
        data: { verification_status: "rejected" },
      })

      // Email notification sent to lawyer — see /api/notify/email
      fetch("/api/notify/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: "verification_rejected", data: { lawyer_id: lawyerId } }),
      }).catch(() => {})

      setLawyers(lawyers.filter(l => l.id !== lawyerId))

      toast({
        title: "Lawyer Rejected",
        description: "The lawyer has been marked as rejected and notified.",
        variant: "destructive"
      })
    } catch (error) {
      console.error("Rejection error:", error)
      toast({
        title: "Error",
        description: "Failed to reject lawyer.",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-gray-50">
        <XCircle className="h-16 w-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
        <p className="text-gray-600 mt-2">You do not have administrative privileges.</p>
        <Button className="mt-6" onClick={() => router.push("/auth/admin/sign-in")}>
          Return to Login
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <AdminHeader />

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
              Lawyer Verifications
            </h1>
            <p className="text-gray-500 mt-1">
              Review and approve newly registered legal professionals
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Search by name or email..." className="pl-9 bg-white" />
            </div>
            <Button variant="outline" className="bg-white">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
          </div>
        </div>

        {lawyers.length === 0 ? (
          <Card className="border-dashed border-2 py-16 text-center bg-white">
            <div className="bg-green-50 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">All Lawyers Verified</h2>
            <p className="text-gray-500 mt-1 max-w-xs mx-auto">
              There are no pending registrations waiting for review.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2 text-sm font-medium text-gray-500 uppercase tracking-wider">
              <span>Lawyer Details</span>
              <span className="hidden md:block">License Information</span>
              <span className="text-right">Actions</span>
            </div>

            {lawyers.map((lawyer) => (
              <Card key={lawyer.id} className="overflow-hidden bg-white hover:shadow-md transition-shadow border-gray-200">
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row items-stretch">
                    {/* User Info Section */}
                    <div className="p-6 md:w-1/3 flex items-center gap-4 border-b md:border-b-0 md:border-r border-gray-100">
                      <Avatar className="h-14 w-14 border border-gray-200 shadow-sm">
                        <AvatarImage src={lawyer.avatar_url} />
                        <AvatarFallback className="bg-primary/5 text-primary">
                          {lawyer.first_name?.[0]}{lawyer.last_name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-gray-900 truncate">
                          {lawyer.first_name} {lawyer.last_name}
                        </h3>
                        <p className="text-sm text-gray-500 truncate">{lawyer.email}</p>
                        <Badge variant="secondary" className="mt-1 font-normal text-[10px] uppercase tracking-wide">
                          Member since {new Date().toLocaleDateString()}
                        </Badge>
                      </div>
                    </div>

                    {/* License Section */}
                    <div className="p-6 flex-1 bg-gray-50/30">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                        <div>
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">
                            Bar License
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono font-bold text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10">
                              {lawyer.lawyer_profile.bar_license_number || "PENDING"}
                            </span>
                            {lawyer.lawyer_profile.ai_license_match === true && (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px]">
                                <ShieldCheck className="h-3 w-3 mr-1" /> AI Matched
                              </Badge>
                            )}
                            {lawyer.lawyer_profile.ai_license_match === false && (
                              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-[10px]">
                                <AlertTriangle className="h-3 w-3 mr-1" /> AI Mismatch
                              </Badge>
                            )}
                          </div>
                          {lawyer.lawyer_profile.ai_license_match === false && lawyer.lawyer_profile.ai_extracted_license && (
                            <p className="text-xs text-yellow-600 mt-1 truncate max-w-xs" title={lawyer.lawyer_profile.ai_extracted_license}>
                              Extracted: {lawyer.lawyer_profile.ai_extracted_license}
                            </p>
                          )}
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">
                            Experience
                          </span>
                          <span className="text-sm font-medium text-gray-700">
                            {lawyer.lawyer_profile.years_of_experience} Years Practice
                          </span>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">
                            Specializations
                          </span>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {lawyer.lawyer_profile.specializations?.map((s, i) => (
                              <Badge key={i} variant="outline" className="bg-white text-gray-600 border-gray-200 text-[10px] font-medium">
                                {s}
                              </Badge>
                            )) || <span className="text-xs text-gray-400 italic">None listed</span>}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Section */}
                    <div className="p-6 md:w-1/4 flex flex-col justify-center gap-2 bg-gray-50/50 border-t md:border-t-0 md:border-l border-gray-100">
                      <Button
                        className="w-full bg-green-600 hover:bg-green-700 text-white shadow-sm"
                        onClick={() => handleVerify(lawyer.id)}
                        disabled={isProcessing === lawyer.id}
                      >
                        {isProcessing === lawyer.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <CheckCircle className="h-4 w-4 mr-2" />
                        )}
                        Approve
                      </Button>
                      <div className="flex gap-2">
                        {lawyer.lawyer_profile.license_file_url ? (
                          <Button
                            variant="outline"
                            className="flex-1 text-xs border-primary text-primary hover:bg-primary/5"
                            onClick={() => window.open(lawyer.lawyer_profile.license_file_url, '_blank')}
                          >
                            <ExternalLink className="h-3 w-3 mr-1.5" />
                            View License
                          </Button>
                        ) : (
                          <Button variant="outline" className="flex-1 text-xs border-gray-300" disabled>
                            No Doc
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          className="flex-1 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                          onClick={() => handleReject(lawyer.id)}
                          disabled={isProcessing === lawyer.id}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
