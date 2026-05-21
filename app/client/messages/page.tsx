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
    <div className="flex h-[calc(100dvh-10.5rem)] min-h-0 flex-col gap-4">
      <div className="shrink-0">
        <h1 className="text-3xl font-bold">Messages</h1>
        <p className="mt-2 text-muted-foreground">
          Communicate with your lawyers in real-time
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
          <MessagesShell userType="client" className="h-full min-h-[28rem]" />
        </Suspense>
      </div>
    </div>
  )
}
