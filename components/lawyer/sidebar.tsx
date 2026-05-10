"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Briefcase, TrendingUp, Star, Users, AlertCircle, Calendar, MessageSquare, Loader2, Gavel } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { useUnreadMessages } from "@/hooks/use-unread-messages"
import { formatLawyerRatingLabel, normalizeLawyerAverageRating } from "@/lib/lawyer-rating"

interface LawyerSidebarProps {
    onNavigate?: () => void
}

interface Stats {
    totalCases: number
    totalEarnings: number
    avgRating: number
    activeClients: number
}

export function LawyerSidebar({ onNavigate }: LawyerSidebarProps) {
    const unreadCount = useUnreadMessages()
    const [stats, setStats] = useState<Stats>({
        totalCases: 0,
        totalEarnings: 0,
        avgRating: 0,
        activeClients: 0,
    })
    const [isLoading, setIsLoading] = useState(true)
    const { toast } = useToast()

    useEffect(() => {
        const fetchStats = async () => {
            try {
                setIsLoading(true)
                const supabase = createClient()

                const { data: { session } } = await supabase.auth.getSession()
                if (!session?.user?.id) {
                    return
                }

                // Fetch total cases
                const { count: totalCases } = await supabase
                    .from("cases")
                    .select("*", { count: "exact", head: true })
                    .eq("lawyer_id", session.user.id)

                // Fetch total earnings (completed payments)
                const { data: payments } = await supabase
                    .from("payments")
                    .select("amount")
                    .eq("lawyer_id", session.user.id)
                    .eq("status", "completed")

                const totalEarnings = (payments || []).reduce((sum, p) => sum + p.amount, 0)

                // Fetch average rating from lawyer_profiles
                const { data: lawyerProfile } = await supabase
                    .from("lawyer_profiles")
                    .select("average_rating")
                    .eq("id", session.user.id)
                    .single()

                // Fetch active clients (unique clients from open/in_progress cases)
                const { data: activeCases } = await supabase
                    .from("cases")
                    .select("client_id")
                    .eq("lawyer_id", session.user.id)
                    .in("status", ["open", "in_progress"])

                const uniqueClients = new Set((activeCases || []).map(c => c.client_id))

                setStats({
                    totalCases: totalCases || 0,
                    totalEarnings: totalEarnings,
                    avgRating: normalizeLawyerAverageRating(lawyerProfile?.average_rating),
                    activeClients: uniqueClients.size,
                })
            } catch (error) {
                console.error("Error fetching stats:", error)
                toast({
                    title: "Error",
                    description: "Failed to load stats",
                    variant: "destructive",
                })
            } finally {
                setIsLoading(false)
            }
        }

        fetchStats()
    }, [toast])

    return (
        <div className="space-y-4">
            {/* Quick Actions */}
            <Card className="p-4">
                <h3 className="font-semibold mb-3 text-sm md:text-base">Quick Actions</h3>
                <div className="space-y-2">
                    <Link href="/lawyer/appointments" onClick={onNavigate}>
                        <Button
                            variant="ghost"
                            className="w-full justify-start text-xs md:text-sm"
                            size="sm"
                        >
                            <Calendar className="h-4 w-4 mr-2" />
                            Appointments
                        </Button>
                    </Link>
                    <Link href="/lawyer/messages" onClick={onNavigate}>
                        <Button
                            variant="ghost"
                            className="w-full justify-start text-xs md:text-sm relative"
                            size="sm"
                        >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Messages
                            {unreadCount > 0 && (
                                <Badge className="ml-auto bg-red-500 hover:bg-red-600 border-none text-[10px] px-1.5 h-5 min-w-[1.25rem]">
                                    {unreadCount}
                                </Badge>
                            )}
                        </Button>
                    </Link>
                    <Link href="/lawyer/cases" onClick={onNavigate}>
                        <Button
                            variant="ghost"
                            className="w-full justify-start text-xs md:text-sm"
                            size="sm"
                        >
                            <Briefcase className="h-4 w-4 mr-2" />
                            Cases
                        </Button>
                    </Link>
                    <Link href="/lawyer/judge-simulation" onClick={onNavigate}>
                        <Button
                            variant="ghost"
                            className="w-full justify-start text-xs md:text-sm"
                            size="sm"
                        >
                            <Gavel className="h-4 w-4 mr-2" />
                            Judge Simulation
                        </Button>
                    </Link>
                </div>
            </Card>

            {/* Profile Management */}
            <Card className="p-4">
                <h3 className="font-semibold mb-3 text-sm md:text-base">Profile Management</h3>
                <div className="space-y-2">
                    <Link href="/lawyer/profile?tab=professional" onClick={onNavigate}>
                        <Button variant="ghost" className="w-full justify-start text-xs md:text-sm" size="sm">
                            <span className="mr-2">👤</span> Professional Info
                        </Button>
                    </Link>
                    <Link href="/lawyer/profile?tab=specializations" onClick={onNavigate}>
                        <Button variant="ghost" className="w-full justify-start text-xs md:text-sm" size="sm">
                            <span className="mr-2">⚖️</span> Specializations
                        </Button>
                    </Link>
                    <Link href="/lawyer/profile?tab=security" onClick={onNavigate}>
                        <Button variant="ghost" className="w-full justify-start text-xs md:text-sm" size="sm">
                            <span className="mr-2">🔒</span> Security & Account
                        </Button>
                    </Link>
                </div>
            </Card>

            {/* Key Metrics */}
            <Card className="p-4 bg-gradient-to-br from-primary/5 to-accent/5">
                <h3 className="font-semibold mb-4">Your Stats</h3>
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Briefcase className="h-4 w-4 text-primary" />
                                <span className="text-sm">Total Cases</span>
                            </div>
                            <span className="font-bold text-lg">{stats.totalCases}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-green-600" />
                                <span className="text-sm">Total Earnings</span>
                            </div>
                            <span className="font-bold text-lg">${stats.totalEarnings.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Star className="h-4 w-4 text-yellow-500" />
                                <span className="text-sm">Avg Rating</span>
                            </div>
                            <span className="font-bold text-lg">
                                {stats.avgRating > 0 ? formatLawyerRatingLabel(stats.avgRating) : "N/A"}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-blue-600" />
                                <span className="text-sm">Active Clients</span>
                            </div>
                            <span className="font-bold text-lg">{stats.activeClients}</span>
                        </div>
                    </div>
                )}
            </Card>

            {/* Upgrade Banner */}
            <Card className="p-4 border-primary/30 bg-primary/5">
                <div className="flex gap-2">
                    <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium">Upgrade to Pro</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Get priority placement, advanced analytics, and more client requests.
                        </p>
                        <Button size="sm" className="mt-2 w-full">
                            Upgrade Now
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Promote Section */}
            <Card className="p-4">
                <h3 className="font-semibold mb-3">Promote your profile</h3>
                <div className="space-y-2">
                    <div>
                        <p className="text-sm font-medium">Availability Badge</p>
                        <Badge className="mt-1 bg-green-500/20 text-green-700 dark:text-green-400">Available</Badge>
                    </div>
                    <Button variant="outline" size="sm" className="w-full mt-2 bg-transparent">
                        Edit availability
                    </Button>
                </div>
            </Card>
        </div>
    )
}
