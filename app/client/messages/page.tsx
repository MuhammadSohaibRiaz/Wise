import type { Metadata } from "next"
import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { MessagesShell } from "@/components/chat/messages-shell"

export const metadata: Metadata = {
  title: "Messages — WiseCase",
  description: "Chat with your lawyers",
}

export default function ClientMessagesPage() {
  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Messages</h1>
        <p className="text-muted-foreground mt-2">
          Communicate with your lawyers in real-time
        </p>
      </div>

      <Suspense
        fallback={
          <div className="flex h-[40vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <MessagesShell userType="client" />
      </Suspense>
    </main>
  )
}
