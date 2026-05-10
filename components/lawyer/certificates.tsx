"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Award, Loader2, AlertCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface Certification {
    id: string
    title: string
    issuer: string
    issue_date?: string
    expiry_date?: string
}

export function LawyerCertificates() {
    const [certifications, setCertifications] = useState<Certification[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const { toast } = useToast()

    useEffect(() => {
        const fetchCertifications = async () => {
            try {
                setIsLoading(true)
                setError(null)
                const supabase = createClient()

                const { data: { session } } = await supabase.auth.getSession()
                if (!session?.user?.id) {
                    setError("Not authenticated")
                    return
                }

                const { data, error: fetchError } = await supabase
                    .from("certifications")
                    .select("*")
                    .eq("lawyer_id", session.user.id)
                    .order("issue_date", { ascending: false })

                if (fetchError) {
                    console.error("[Certificates] Error fetching certifications:", fetchError)
                    throw fetchError
                }

                setCertifications(data || [])
                console.log("[Certificates] Loaded certifications:", data?.length || 0)
            } catch (error: any) {
                console.error("[Certificates] Error:", error)
                setError(error.message || "Failed to load certifications")
                toast({
                    title: "Error",
                    description: "Failed to load certifications",
                    variant: "destructive",
                })
            } finally {
                setIsLoading(false)
            }
        }

        fetchCertifications()
    }, [toast])

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Award className="h-5 w-5" />
                        Certifications & Qualifications
                    </CardTitle>
                    <CardDescription>Your professional certifications</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (error) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Award className="h-5 w-5" />
                        Certifications & Qualifications
                    </CardTitle>
                    <CardDescription>Your professional certifications</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-2 p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                        <AlertCircle className="h-5 w-5 text-destructive" />
                        <p className="text-sm text-destructive">{error}</p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Award className="h-5 w-5" />
                            Certifications & Qualifications
                        </CardTitle>
                        <CardDescription>Your professional certifications</CardDescription>
                    </div>
                    <Link href="/lawyer/profile?tab=specializations">
                        <Button variant="outline" size="sm">
                            Add
                        </Button>
                    </Link>
                </div>
            </CardHeader>
            <CardContent>
                {certifications.length === 0 ? (
                    <div className="text-center py-8">
                        <Award className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                        <p className="text-sm text-muted-foreground mb-4">No certifications added yet</p>
                        <Link href="/lawyer/profile?tab=specializations">
                            <Button size="sm">Add Certification</Button>
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {certifications.map((cert) => (
                            <div
                                key={cert.id}
                                className="p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm truncate">{cert.title}</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {cert.issuer}
                                            {cert.issue_date && ` • ${new Date(cert.issue_date).getFullYear()}`}
                                        </p>
                                    </div>
                                    {cert.expiry_date && new Date(cert.expiry_date) > new Date() && (
                                        <Badge variant="secondary" className="text-xs flex-shrink-0">
                                            Valid
                                        </Badge>
                                    )}
                                    {cert.expiry_date && new Date(cert.expiry_date) <= new Date() && (
                                        <Badge variant="destructive" className="text-xs flex-shrink-0">
                                            Expired
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
