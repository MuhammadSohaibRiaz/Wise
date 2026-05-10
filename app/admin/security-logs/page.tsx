"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { AdminHeader } from "@/components/admin/admin-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, ShieldAlert } from "lucide-react"

interface SecurityLogRow {
  id: string
  document_id: string | null
  user_id: string | null
  detected_attack_type: string
  severity: string
  raw_excerpt: string | null
  created_at: string
}

export default function AdminSecurityLogsPage() {
  const [rows, setRows] = useState<SecurityLogRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      setError(null)
      const { data, error: qErr } = await supabase
        .from("ai_security_logs")
        .select("id, document_id, user_id, detected_attack_type, severity, raw_excerpt, created_at")
        .order("created_at", { ascending: false })
        .limit(200)

      if (cancelled) return
      if (qErr) {
        setError(qErr.message)
        setRows([])
      } else {
        setRows((data as SecurityLogRow[]) || [])
      }
      setIsLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [supabase])

  const severityVariant = (s: string) => {
    if (s === "high") return "destructive" as const
    if (s === "medium") return "secondary" as const
    return "outline" as const
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <AdminHeader />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-start gap-3 mb-8">
          <div className="p-2 rounded-lg bg-amber-100">
            <ShieldAlert className="h-8 w-8 text-amber-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI security logs</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Heuristic prompt-injection and abuse signals captured during document analysis (latest 200).
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        ) : error ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-6 text-sm text-red-800">{error}</CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Events</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No security events recorded yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">When</th>
                      <th className="py-2 pr-4 font-medium">Severity</th>
                      <th className="py-2 pr-4 font-medium">Type</th>
                      <th className="py-2 pr-4 font-medium">Excerpt</th>
                      <th className="py-2 pr-4 font-medium">Document</th>
                      <th className="py-2 font-medium">User</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-b border-border/60 align-top">
                        <td className="py-3 pr-4 whitespace-nowrap text-muted-foreground">
                          {new Date(r.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge variant={severityVariant(r.severity)}>{r.severity}</Badge>
                        </td>
                        <td className="py-3 pr-4 font-medium">{r.detected_attack_type}</td>
                        <td className="py-3 pr-4 max-w-md">
                          <span className="line-clamp-2 text-muted-foreground" title={r.raw_excerpt || undefined}>
                            {r.raw_excerpt || "—"}
                          </span>
                        </td>
                        <td className="py-3 pr-4 font-mono text-xs">
                          {r.document_id ? r.document_id.slice(0, 8) + "…" : "—"}
                        </td>
                        <td className="py-3 font-mono text-xs">
                          {r.user_id ? r.user_id.slice(0, 8) + "…" : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
