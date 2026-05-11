"use client"

import { Card } from "@/components/ui/card"
import { AdminHeader } from "@/components/admin/admin-header"
import { ShieldOff } from "lucide-react"

export default function AdminDisputesPage() {
  return (
    <div className="min-h-screen bg-gray-50/50 pb-20">
      <AdminHeader />

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Case Disputes</h1>
          <p className="text-gray-500 mt-1">Review and mediate conflicts between clients and lawyers</p>
        </div>

        <Card className="border-dashed border-2 py-20 text-center bg-white">
          <ShieldOff className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-muted-foreground">Disputes Module Disabled</h2>
          <p className="text-muted-foreground mt-1 max-w-md mx-auto">
            The dispute feature is currently disabled. Clients confirm or decline case completion directly.
            This module will be re-enabled in a future update.
          </p>
        </Card>
      </main>
    </div>
  )
}
