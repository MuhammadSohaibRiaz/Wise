"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { AdminHeader } from "@/components/admin/admin-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Users, 
  Briefcase, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp, 
  Clock,
  ShieldCheck
} from "lucide-react"
import { Loader2 } from "lucide-react"

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalLawyers: 0,
    pendingVerifications: 0,
    openDisputes: 0,
    totalCases: 0
  })
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchStats() {
      try {
        const [
          { count: usersCount },
          { count: lawyersCount },
          { count: pendingCount },
          { count: disputesCount },
          { count: casesCount }
        ] = await Promise.all([
          supabase.from("profiles").select("*", { count: 'exact', head: true }),
          supabase.from("profiles").select("*", { count: 'exact', head: true }).eq("user_type", "lawyer"),
          supabase.from("lawyer_profiles").select("*", { count: 'exact', head: true }).eq("verified", false),
          supabase.from("case_disputes").select("*", { count: 'exact', head: true }).eq("status", "open"),
          supabase.from("cases").select("*", { count: 'exact', head: true })
        ])

        setStats({
          totalUsers: usersCount || 0,
          totalLawyers: lawyersCount || 0,
          pendingVerifications: pendingCount || 0,
          openDisputes: disputesCount || 0,
          totalCases: casesCount || 0
        })
      } catch (error) {
        console.error("Error fetching admin stats:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
  }, [])

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
      title: "Active Disputes",
      value: stats.openDisputes,
      icon: AlertTriangle,
      color: "text-red-600",
      bg: "bg-red-50",
      link: "/admin/disputes"
    }
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statCards.map((stat, i) => (
            <Card key={i} className="hover:shadow-md transition-shadow cursor-default">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                    <h3 className="text-3xl font-bold mt-1">{stat.value}</h3>
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
                className="w-full justify-start gap-2 h-12"
                onClick={() => window.location.href = '/admin/disputes'}
              >
                <AlertTriangle className="h-4 w-4" />
                Manage Case Disputes
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

          {/* Activity Placeholder */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Platform Growth</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent className="h-[240px] flex items-center justify-center border-t">
              <div className="text-center">
                <div className="bg-primary/5 p-4 rounded-full w-fit mx-auto mb-4">
                  <TrendingUp className="h-8 w-8 text-primary/40" />
                </div>
                <p className="text-sm text-muted-foreground">User growth and engagement charts will appear here as data accumulates.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
