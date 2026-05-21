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

      <div className="mx-auto flex h-[calc(100dvh-14rem)] max-w-7xl min-h-0 flex-col gap-4 px-4 py-6 md:px-6 lg:px-8">
        <div className="shrink-0">
          <h1 className="text-3xl font-bold">Messages</h1>
          <p className="mt-2 text-muted-foreground">
            Stay connected with your clients and respond to important updates instantly.
          </p>
        </div>

        <div className="min-h-0 flex-1">
          <Suspense
            fallback={
              <div className="flex h-[40vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            }
          >
            <MessagesShell userType="lawyer" className="h-full min-h-[28rem]" />
          </Suspense>
        </div>
      </div>
    </div>
  )
}


