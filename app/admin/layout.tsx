"use client"

import type React from "react"
import { Loader2 } from "lucide-react"
import { useAdminAccess } from "@/hooks/use-admin-access"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const access = useAdminAccess()

  if (access !== "allowed") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return <>{children}</>
}
