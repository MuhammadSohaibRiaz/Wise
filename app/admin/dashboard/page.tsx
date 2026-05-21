"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { AdminHeader } from "@/components/admin/admin-header"
import { useAdminCancellationSync } from "@/lib/hooks/use-admin-cancellation-sync"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Users, 
  Briefcase, 
  TrendingUp, 
  Clock,
  ShieldCheck,
  AlertCircle,
} from "lucide-react"
import { Loader2 } from "lucide-react"

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalLawyers: 0,
    pendingVerifications: 0,
    openDisputes: 0,
    totalCases: 0,
    pendingCancellations: 0,
    awaitingRefund: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const supabase = createClient()

  const loadCancellationCounts = useCallback(async () => {
    try {
      const cancelRes = await fetch("/api/admin/cancellation-requests/count", { cache: "no-store" })
      if (!cancelRes.ok) return
      const cancelJson = await cancelRes.json()
      setStats((prev) => ({
        ...prev,
        pendingCancellations: cancelJson.pending_count ?? 0,
        awaitingRefund: cancelJson.awaiting_refund_count ?? 0,
      }))
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    async function fetchStats() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .maybeSingle()

      if (profile?.user_type !== "admin") return
      setIsAdmin(true)

      try {
        const [
          { count: usersCount },
          { count: lawyersCount },
          { count: pendingCount },
          { count: casesCount }
        ] = await Promise.all([
          supabase.from("profiles").select("*", { count: 'exact', head: true }),
          supabase.from("profiles").select("*", { count: 'exact', head: true }).eq("user_type", "lawyer"),
          supabase.from("lawyer_profiles").select("*", { count: 'exact', head: true }).eq("verified", false),
          supabase.from("cases").select("*", { count: 'exact', head: true })
        ])

        setStats((prev) => ({
          ...prev,
          totalUsers: usersCount || 0,
          totalLawyers: lawyersCount || 0,
          pendingVerifications: pendingCount || 0,
          openDisputes: 0,
          totalCases: casesCount || 0,
        }))
        await loadCancellationCounts()
      } catch (error) {
        console.error("Error fetching admin stats:", error)
      } finally {
        setIsLoading(false)
      }
    }

    void fetchStats()
  }, [loadCancellationCounts, supabase])

  useAdminCancellationSync({
    enabled: isAdmin,
    onSync: loadCancellationCounts,
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50/50">
        <AdminHeader />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  const statCards = [
    {
      title: "Total Users",
      value: stats.totalUsers,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50"
    },
    {
      title: "Verified Lawyers",
      value: stats.totalLawyers - stats.pendingVerifications,
      icon: ShieldCheck,
      color: "text-green-600",
      bg: "bg-green-50"
    },
    {
      title: "Pending Verifications",
      value: stats.pendingVerifications,
      icon: Clock,
      color: "text-orange-600",
      bg: "bg-orange-50",
      link: "/admin/lawyers"
    },
    {
      title: "Total Cases",
      value: stats.totalCases,
      icon: Briefcase,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
    },
    {
      title: "Cancellation requests",
      value: stats.pendingCancellations,
      icon: AlertCircle,
      color: "text-amber-700",
      bg: "bg-amber-50",
      link: "/admin/cancellation-requests",
      subtitle:
        stats.awaitingRefund > 0
          ? `${stats.awaitingRefund} awaiting refund`
          : undefined,
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50/50">
      <AdminHeader />
      
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">System Overview</h1>
          <p className="text-gray-500 mt-1">Real-time statistics and platform health monitoring</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-8">
          {statCards.map((stat, i) => (
            <Card
              key={i}
              className={`hover:shadow-md transition-shadow ${stat.link ? "cursor-pointer" : "cursor-default"}`}
              onClick={stat.link ? () => { window.location.href = stat.link! } : undefined}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                    <h3 className="text-3xl font-bold mt-1">{stat.value}</h3>
                    {"subtitle" in stat && stat.subtitle ? (
                      <p className="text-xs text-amber-700 mt-1">{stat.subtitle}</p>
                    ) : null}
                  </div>
                  <div className={`p-3 rounded-xl ${stat.bg}`}>
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Quick Actions */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2 h-12" 
                onClick={() => window.location.href = '/admin/lawyers'}
              >
                <Briefcase className="h-4 w-4" />
                Review Pending Lawyers
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2 h-12 relative"
                onClick={() => window.location.href = '/admin/cancellation-requests'}
              >
                <AlertCircle className="h-4 w-4" />
                Cancellation requests
                {(stats.pendingCancellations + stats.awaitingRefund) > 0 && (
                  <span className="ml-auto inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {stats.pendingCancellations + stats.awaitingRefund > 99
                      ? "99+"
                      : stats.pendingCancellations + stats.awaitingRefund}
                  </span>
                )}
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2 h-12"
                onClick={() => window.location.href = '/admin/security-logs'}
              >
                <ShieldCheck className="h-4 w-4" />
                AI Security Logs
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2 h-12"
                onClick={() => window.location.href = '/admin/users'}
              >
                <Users className="h-4 w-4" />
                View All Users
              </Button>
            </CardContent>
          </Card>

          {/* Cancellation queue — live counts */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Cancellation queue</CardTitle>
              <AlertCircle className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent className="border-t pt-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
                  <p className="text-sm text-amber-900 font-medium">Pending review</p>
                  <p className="text-3xl font-bold text-amber-950 mt-1">{stats.pendingCancellations}</p>
                  <p className="text-xs text-amber-800/80 mt-1">Awaiting approve or reject</p>
                </div>
                <div className="rounded-lg border border-purple-200 bg-purple-50/60 p-4">
                  <p className="text-sm text-purple-900 font-medium">Awaiting Stripe refund</p>
                  <p className="text-3xl font-bold text-purple-950 mt-1">{stats.awaitingRefund}</p>
                  <p className="text-xs text-purple-800/80 mt-1">Approved cancel + completed payment</p>
                </div>
              </div>
              {(stats.pendingCancellations + stats.awaitingRefund) > 0 ? (
                <Button
                  className="w-full sm:w-auto"
                  onClick={() => { window.location.href = "/admin/cancellation-requests" }}
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Open cancellation requests
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500 shrink-0" />
                  No cancellations need action. Counts update live when requests arrive.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
