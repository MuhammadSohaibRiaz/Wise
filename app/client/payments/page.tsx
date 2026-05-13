"use client"

import { useEffect, useState, useCallback } from "react"
import type { Metadata } from "next"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Download, CreditCard, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface Payment {
  id: string
  amount: number
  status: "pending" | "completed" | "failed" | "refunded"
  payment_method: string | null
  created_at: string
  case: {
    id: string
    title: string
  } | null
  lawyer: {
    id: string
    first_name: string | null
    last_name: string | null
  } | null
}

const statusConfig: Record<Payment["status"], { label: string; className: string }> = {
  pending: {
    label: "Pending",
    className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  },
  completed: {
    label: "Completed",
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  },
  failed: {
    label: "Failed",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  },
  refunded: {
    label: "Refunded",
    className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  },
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [stats, setStats] = useState({
    totalSpent: 0,
    pending: 0,
  })
  const { toast } = useToast()

  const fetchPayments = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const supabase = createClient()

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) {
        setError("You must be logged in to view payments")
        toast({
          title: "Authentication Required",
          description: "Please log in to view your payments",
          variant: "destructive",
        })
        return
      }

      setUserId(session.user.id)

      const { data, error: fetchError } = await supabase
        .from("payments")
        .select(`
          id,
          amount,
          status,
          payment_method,
          created_at,
          case:cases!payments_case_id_fkey (
            id,
            title
          ),
          lawyer:profiles!payments_lawyer_id_fkey (
            id,
            first_name,
            last_name
          )
        `)
        .eq("client_id", session.user.id)
        .order("created_at", { ascending: false })

      if (fetchError) {
        console.error("[Payments] Error fetching payments:", fetchError)
        throw fetchError
      }

      setPayments(data || [])

      const totalSpent = (data || [])
        .filter((p) => p.status === "completed")
        .reduce((sum, p) => sum + p.amount, 0)

      const pending = (data || [])
        .filter((p) => p.status === "pending")
        .reduce((sum, p) => sum + p.amount, 0)

      setStats({ totalSpent, pending })
    } catch (error) {
      console.error("Error fetching payments:", error)
      toast({
        title: "Error",
        description: "Failed to load payments",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchPayments()
  }, [fetchPayments])

  useEffect(() => {
    if (!userId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`payments-client-${userId}-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payments",
          filter: `client_id=eq.${userId}`,
        },
        () => {
          void fetchPayments()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, fetchPayments])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  return (
    <main className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Payments</h1>
        <p className="text-muted-foreground mt-2">Track your payments and transaction history</p>
      </div>

      {/* Summary Cards */}
      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalSpent.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.pending.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Awaiting payment</p>
          </CardContent>
        </Card>
      </section>

      {/* Payment History */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Payment History</h2>

        {error ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CreditCard className="h-12 w-12 text-destructive mb-4" />
              <p className="text-lg font-medium text-destructive">Error Loading Payments</p>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <Button onClick={() => window.location.reload()} variant="outline">
                Try Again
              </Button>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : payments.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No payments yet</p>
              <p className="text-sm text-muted-foreground">Your payment history will appear here</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {payments.map((payment) => (
              <Card key={payment.id}>
                <CardContent className="flex items-center justify-between p-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold">
                        {payment.case?.title || "Payment"}
                      </h3>
                      <Badge className={(statusConfig[payment.status] ?? statusConfig.pending).className}>
                        {(statusConfig[payment.status] ?? statusConfig.pending).label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{formatDate(payment.created_at)}</span>
                      {payment.lawyer && (
                        <span>
                          To: {payment.lawyer.first_name} {payment.lawyer.last_name}
                        </span>
                      )}
                      {payment.payment_method && (
                        <span className="capitalize">{payment.payment_method}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-lg font-bold">${payment.amount.toLocaleString()}</p>
                    </div>
                    {payment.status === "completed" && (
                      <Button variant="outline" size="sm" className="gap-2">
                        <Download className="h-4 w-4" />
                        Receipt
                      </Button>
                    )}
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
