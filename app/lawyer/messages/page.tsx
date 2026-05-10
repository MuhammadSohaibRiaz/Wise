import type { Metadata } from "next"
import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { MessagesShell } from "@/components/chat/messages-shell"
import { LawyerDashboardHeader } from "@/components/lawyer/dashboard-header"

export const metadata: Metadata = {
  title: "Messages — WiseCase Lawyer Workspace",
  description: "Collaborate with your clients in real-time and keep every case on track.",
}

export default function LawyerMessagesPage() {
  return (
    <div className="min-h-screen bg-background">
      <LawyerDashboardHeader />

      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Messages</h1>
          <p className="text-muted-foreground mt-2">
            Stay connected with your clients and respond to important updates instantly.
          </p>
        </div>

        <Suspense
          fallback={
            <div className="flex h-[40vh] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <MessagesShell userType="lawyer" />
        </Suspense>
      </div>
    </div>
  )
}


