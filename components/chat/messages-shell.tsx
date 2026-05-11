"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, MessageSquare, Paperclip, Send, CheckCircle2, ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { notifyMessage } from "@/lib/notifications"

type MessageStatus = "pending" | "scheduled" | "completed" | "cancelled" | "rescheduled" | "rejected"

interface ParticipantProfile {
  id: string
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  avatar_url?: string | null
  user_type?: string | null
}

interface ConversationSummary {
  id: string
  title: string
  caseType?: string | null
  status: MessageStatus
  participant: ParticipantProfile | null
  participantId: string | null
  clientId: string
  lawyerId: string | null
  lastActivityAt?: string | null
  /** Client can message once a consultation is past the pending/rejected appointment stage */
  chatUnlocked?: boolean
}

interface ChatMessage {
  id: string
  case_id: string
  sender_id: string
  recipient_id: string
  content: string
  is_read: boolean
  created_at: string
}

interface MessagesShellProps {
  userType: "client" | "lawyer"
}

const MESSAGE_LIMIT = 150

function formatSendError(err: unknown): string {
  if (err && typeof err === "object" && "message" in err && typeof (err as { message: string }).message === "string") {
    return (err as { message: string }).message
  }
  return "Please try again."
}

function groupMessagesByDate(messages: ChatMessage[]) {
  const groups: { date: string; messages: ChatMessage[] }[] = []
  
  messages.forEach((message) => {
    const date = new Date(message.created_at).toLocaleDateString([], { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
    
    const today = new Date().toLocaleDateString([], { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })

    const displayDate = date === today ? "Today" : date
    
    const existingGroup = groups.find((g) => g.date === displayDate)
    if (existingGroup) {
      existingGroup.messages.push(message)
    } else {
      groups.push({ date: displayDate, messages: [message] })
    }
  })
  
  return groups
}

export function MessagesShell({ userType }: MessagesShellProps) {
  const supabase = useMemo(() => createClient(), [])
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const linkedLawyerFromUrl = useRef<string | null>(null)

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isLoadingConversations, setIsLoadingConversations] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const [typingParticipant, setTypingParticipant] = useState<string | null>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const fetchCurrentUser = useCallback(async () => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to view your messages.",
        variant: "destructive",
      })
      return null
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .eq("id", user.id)
      .single()

    setCurrentUserId(user.id)
    return user.id
  }, [supabase, toast])

  const loadUnreadCounts = useCallback(
    async (userId: string) => {
      const { data, error } = await supabase
        .from("messages")
        .select("case_id")
        .eq("recipient_id", userId)
        .eq("is_read", false)

      if (error) {
        console.error("[v0] Unread fetch error:", error)
        return
      }

      const counts = (data || []).reduce<Record<string, number>>((acc, item: any) => {
        acc[item.case_id] = (acc[item.case_id] || 0) + 1
        return acc
      }, {})

      setUnreadCounts(counts)
    },
    [supabase],
  )

  const loadConversations = useCallback(
    async (userId: string) => {
      try {
        setIsLoadingConversations(true)

        const { data, error } = await supabase
          .from("cases")
          .select(
            `
            id,
            title,
            case_type,
            status,
            updated_at,
            client_id,
            lawyer_id,
            client:profiles!cases_client_id_fkey (
              id,
              first_name,
              last_name,
              email,
              avatar_url,
              user_type
            ),
            lawyer:profiles!cases_lawyer_id_fkey (
              id,
              first_name,
              last_name,
              email,
              avatar_url,
              user_type
            ),
            appointments (
              id,
              status
            )
          `,
          )
          .or(`client_id.eq.${userId},lawyer_id.eq.${userId}`)
          .order("updated_at", { ascending: false })

        if (error) throw error

        const missingParticipantIds = new Set<string>()

        const mappedRaw: ConversationSummary[] = (data || []).map((caseItem: any) => {
          const participant = caseItem.client?.id === userId ? caseItem.lawyer : caseItem.client
          const participantId = caseItem.client_id === userId ? caseItem.lawyer_id : caseItem.client_id

          if (!participant && participantId) {
            missingParticipantIds.add(participantId)
          }

          const apptsRaw = caseItem.appointments
          const appts: { status: string }[] = Array.isArray(apptsRaw)
            ? apptsRaw
            : apptsRaw
              ? [apptsRaw]
              : []
          const chatUnlocked = appts.some((a) =>
            ["scheduled", "awaiting_payment", "attended", "completed", "rescheduled"].includes(a.status),
          )

          return {
            id: caseItem.id,
            title: caseItem.title,
            caseType: caseItem.case_type,
            status: caseItem.status,
            participant: participant || null,
            participantId: participantId || null,
            clientId: caseItem.client_id,
            lawyerId: caseItem.lawyer_id,
            lastActivityAt: caseItem.updated_at,
            chatUnlocked,
          }
        })

        if (missingParticipantIds.size > 0) {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("id, first_name, last_name, email, avatar_url, user_type")
            .in("id", Array.from(missingParticipantIds))

          const profileMap =
            profileData?.reduce<Record<string, ParticipantProfile>>((acc, profile) => {
              acc[profile.id] = profile
              return acc
            }, {}) ?? {}

          mappedRaw.forEach((conversation) => {
            if (!conversation.participant && conversation.participantId) {
              conversation.participant = profileMap[conversation.participantId] || null
            }
          })
        }

        const counterpartyKey = (c: ConversationSummary) =>
          userType === "client" ? c.lawyerId || c.id : c.clientId || c.id

        const mapped: ConversationSummary[] = []
        const seenKeys = new Set<string>()
        const sorted = [...mappedRaw].sort(
          (a, b) =>
            new Date(b.lastActivityAt || 0).getTime() - new Date(a.lastActivityAt || 0).getTime(),
        )
        for (const conv of sorted) {
          const key = counterpartyKey(conv)
          if (seenKeys.has(key)) continue
          seenKeys.add(key)
          mapped.push(conv)
        }

        setConversations(mapped)

        if (mapped.length > 0) {
          setActiveCaseId((prev) => prev || mapped[0].id)
        }
      } catch (error) {
        console.error("[v0] Conversation load error:", error)
        toast({
          title: "Error loading conversations",
          description: "Please try again later.",
          variant: "destructive",
        })
      } finally {
        setIsLoadingConversations(false)
      }
    },
    [supabase, toast],
  )

  const markMessagesRead = useCallback(
    async (messageIds: string[], caseId: string) => {
      if (!messageIds.length) return

      const { error } = await supabase.from("messages").update({ is_read: true }).in("id", messageIds)

      if (error) {
        console.error("[v0] Mark read error:", error)
        return
      }

      setUnreadCounts((prev) => ({
        ...prev,
        [caseId]: Math.max(0, (prev[caseId] || 0) - messageIds.length),
      }))
    },
    [supabase],
  )

  const loadMessages = useCallback(
    async (caseId: string, userId: string) => {
      try {
        setIsLoadingMessages(true)

        const { data, error } = await supabase
          .from("messages")
          .select("*")
          .eq("case_id", caseId)
          .order("created_at", { ascending: true })
          .limit(MESSAGE_LIMIT)

        if (error) throw error

        setMessages(data || [])

        const unreadForCase = (data || [])
          .filter((msg) => msg.recipient_id === userId && !msg.is_read)
          .map((msg) => msg.id)

        if (unreadForCase.length > 0) {
          await markMessagesRead(unreadForCase, caseId)
        }
      } catch (error) {
        console.error("[v0] Messages load error:", error)
        toast({
          title: "Error loading messages",
          description: "Unable to load chat history.",
          variant: "destructive",
        })
      } finally {
        setIsLoadingMessages(false)
      }
    },
    [supabase, toast, markMessagesRead],
  )

  useEffect(() => {
    let isMounted = true

    const initialize = async () => {
      const userId = await fetchCurrentUser()
      if (!userId || !isMounted) return
      await Promise.all([loadConversations(userId), loadUnreadCounts(userId)])
    }

    initialize()

    return () => {
      isMounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount

  // When navigating to messages with ?lawyer=<uuid>, reload conversations so
  // any existing case with this lawyer surfaces in the sidebar.
  useEffect(() => {
    const lawyerParam = searchParams.get("lawyer")
    if (!lawyerParam || userType !== "client" || !currentUserId) return
    if (linkedLawyerFromUrl.current === lawyerParam) return

    linkedLawyerFromUrl.current = lawyerParam
    void loadConversations(currentUserId)
  }, [searchParams, userType, currentUserId, loadConversations])

  useEffect(() => {
    if (!currentUserId || !activeCaseId) return
    loadMessages(activeCaseId, currentUserId)

    // Scroll to bottom when messages load
    setTimeout(() => {
      const messagesEnd = document.getElementById("messages-end")
      const messagesContainer = document.getElementById("messages-container")
      if (messagesEnd) {
        messagesEnd.scrollIntoView({ behavior: "auto", block: "end" })
      } else if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight
      }
    }, 200)
  }, [activeCaseId, currentUserId, loadMessages])

  useEffect(() => {
    if (!currentUserId || !activeCaseId) return

    const channel = supabase
      .channel(`messages-case-${activeCaseId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `case_id=eq.${activeCaseId}`,
        },
        (payload) => {
          const newMessage = payload.new as any
          
          if (newMessage.case_id === activeCaseId) {
            if (newMessage.sender_id !== currentUserId) {
              markMessagesRead([newMessage.id], activeCaseId)
            }
            setMessages((prev) => {
            // Check if message already exists (prevent duplicates)
            if (prev.find((msg) => msg.id === newMessage.id)) {
              return prev
            }
            // Sort messages by created_at to maintain order
            const updated = [...prev, newMessage].sort((a, b) =>
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            )

            // Scroll to bottom when new message arrives
            setTimeout(() => {
              const messagesEnd = document.getElementById("messages-end")
              const messagesContainer = document.getElementById("messages-container")
              if (messagesEnd) {
                messagesEnd.scrollIntoView({ behavior: "smooth", block: "end" })
              } else if (messagesContainer) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight
              }
            }, 100)

            return updated
          })

          // Mark as read if recipient is current user
          if (newMessage.recipient_id === currentUserId && !newMessage.is_read) {
            markMessagesRead([newMessage.id], activeCaseId)
          }
        }
      }
    )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `case_id=eq.${activeCaseId}`,
        },
        (payload) => {
          const updatedMessage = payload.new as ChatMessage
          setMessages((prev) =>
            prev.map((msg) => msg.id === updatedMessage.id ? updatedMessage : msg)
          )
        },
      )
      .on("broadcast", { event: "typing" }, (payload) => {
        if (payload.payload.userId !== currentUserId) {
          const conversation = conversations.find(c => c.id === activeCaseId)
          const name = conversation?.participant?.first_name || "Partner"
          setTypingParticipant(payload.payload.isTyping ? name : null)
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log(`[Messages] Subscribed to case ${activeCaseId}`)
        } else if (status === "CHANNEL_ERROR") {
          console.error(`[Messages] Channel error for case ${activeCaseId}`)
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, currentUserId, activeCaseId, markMessagesRead, conversations])

  const handleTyping = useCallback(() => {
    if (!activeCaseId || !currentUserId) return

    const channel = supabase.channel(`messages-case-${activeCaseId}`)
    channel.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: currentUserId, isTyping: true },
    })

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)

    typingTimeoutRef.current = setTimeout(() => {
      channel.send({
        type: "broadcast",
        event: "typing",
        payload: { userId: currentUserId, isTyping: false },
      })
      typingTimeoutRef.current = null
    }, 3000)
  }, [supabase, activeCaseId, currentUserId])

  useEffect(() => {
    if (!currentUserId) return

    const channel = supabase
      .channel(`messages-recipient-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${currentUserId}`,
        },
        (payload) => {
          const newMessage = payload.new as ChatMessage

          setUnreadCounts((prev) => {
            if (newMessage.case_id === activeCaseId) return prev
            return {
              ...prev,
              [newMessage.case_id]: (prev[newMessage.case_id] || 0) + 1,
            }
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, currentUserId, activeCaseId])

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentUserId || !activeCaseId) return
    const conversation = conversations.find((conv) => conv.id === activeCaseId)

    if (
      userType === "client" &&
      conversation?.lawyerId &&
      conversation.chatUnlocked === false
    ) {
      toast({
        title: "Consultation not active yet",
        description:
          "You can message your lawyer here after they accept your appointment request (and payment is settled if required).",
        variant: "destructive",
        duration: 12_000,
      })
      return
    }
    const recipientId =
      conversation?.participant?.id ||
      conversation?.participantId ||
      (conversation?.clientId === currentUserId ? conversation?.lawyerId : conversation?.clientId) ||
      null

    if (!recipientId) {
      toast({
        title: userType === "client" ? "No lawyer on this case yet" : "No client on this case yet",
        description:
          userType === "client"
            ? "Book a consultation or use Messages from the lawyer’s profile so your case is linked. If you opened Messages from analysis, add ?lawyer=… or wait for the lawyer to accept a booking."
            : "The case may still be waiting for client assignment. Refresh after the client books.",
        variant: "destructive",
        duration: 12_000,
      })
      return
    }

    try {
      setIsSending(true)
      const content = newMessage.trim()

      const { error, data } = await supabase
        .from("messages")
        .insert({
          case_id: activeCaseId,
          sender_id: currentUserId,
          recipient_id: recipientId,
          content,
        })
        .select()
        .single()

      if (error) throw error

      // Optimistically add message immediately
      const optimisticMessage = {
        ...data,
        created_at: data.created_at || new Date().toISOString(),
      }
      setMessages((prev) => {
        // Check if message already exists (from real-time)
        if (prev.find((msg) => msg.id === data.id)) {
          return prev
        }
        // Sort messages by created_at to maintain order
        const updated = [...prev, optimisticMessage].sort((a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
        return updated
      })
      setNewMessage("")

      // Scroll to bottom after adding message - increased timeout for reliability
      setTimeout(() => {
        const messagesEnd = document.getElementById("messages-end")
        const messagesContainer = document.getElementById("messages-container")
        if (messagesEnd) {
          messagesEnd.scrollIntoView({ behavior: "smooth", block: "end" })
        } else if (messagesContainer) {
          messagesContainer.scrollTo({
            top: messagesContainer.scrollHeight,
            behavior: "smooth"
          })
        }
      }, 250)

      try {
        await notifyMessage(
          supabase,
          {
            recipientId,
            senderId: currentUserId,
            caseId: activeCaseId,
            caseTitle: conversation?.title,
            contentPreview: content.slice(0, 120),
          }
        )
      } catch (notifyErr) {
        console.warn("[Messages] notifyMessage skipped:", notifyErr)
      }
    } catch (error) {
      console.error("[v0] Send message error:", error)
      toast({
        title: "Failed to send message",
        description: formatSendError(error),
        variant: "destructive",
        duration: 12_000,
      })
    } finally {
      setIsSending(false)
    }
  }

  const handleAttachmentSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file || !currentUserId || !activeCaseId) return

    const conversation = conversations.find((conv) => conv.id === activeCaseId)
    if (
      userType === "client" &&
      conversation?.lawyerId &&
      conversation.chatUnlocked === false
    ) {
      toast({
        title: "Consultation not active yet",
        description: "File sharing unlocks once your booking is accepted.",
        variant: "destructive",
        duration: 12_000,
      })
      return
    }

    const recipientId =
      conversation?.participant?.id ||
      conversation?.participantId ||
      (conversation?.clientId === currentUserId ? conversation?.lawyerId : conversation?.clientId) ||
      null

    if (!recipientId) {
      toast({
        title: "Cannot attach file",
        description: "This conversation does not have an active recipient yet.",
        variant: "destructive",
        duration: 10_000,
      })
      return
    }

    try {
      setIsSending(true)
      const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 120)
      const path = `attachments/${activeCaseId}/${Date.now()}_${safeName}`
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      })
      if (upErr) throw upErr

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path)

      const content = `📎 ${file.name}\n${publicUrl}`

      const { error, data } = await supabase
        .from("messages")
        .insert({
          case_id: activeCaseId,
          sender_id: currentUserId,
          recipient_id: recipientId,
          content,
        })
        .select()
        .single()

      if (error) throw error

      setMessages((prev) => {
        if (prev.find((msg) => msg.id === data.id)) return prev
        return [...prev, data].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        )
      })

      toast({ title: "File sent", description: file.name })
    } catch (error) {
      console.error("[Messages] Attachment error:", error)
      toast({
        title: "Upload failed",
        description: formatSendError(error),
        variant: "destructive",
        duration: 12_000,
      })
    } finally {
      setIsSending(false)
    }
  }

  const activeConversation = conversations.find((conv) => conv.id === activeCaseId) || null
  const messagingBlocked =
    userType === "client" &&
    !!activeConversation?.lawyerId &&
    activeConversation.chatUnlocked === false

  if (isLoadingConversations) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center space-y-2">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Loading conversations...</p>
        </div>
      </div>
    )
  }

  if (!conversations.length) {
    return (
      <Card className="p-10 text-center">
        <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No conversations yet</h3>
        <p className="text-sm text-muted-foreground">
          {userType === "client"
            ? "Book a consultation or start a case to begin chatting with a lawyer."
            : "You’ll see chats here once a client opens a case with you."}
        </p>
      </Card>
    )
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-180px)] w-full overflow-hidden bg-background/50 backdrop-blur-sm rounded-3xl border border-border/50 shadow-2xl relative">
      {/* Sidebar */}
      <Card className={cn(
        "w-full md:w-80 lg:w-96 flex flex-col h-full border-none bg-card/40 backdrop-blur-md rounded-none border-r border-border/30",
        activeCaseId ? "hidden md:flex" : "flex"
      )}>
        <CardHeader className="px-6 py-8">
          <CardTitle className="text-2xl font-bold tracking-tight">Messages</CardTitle>
          <p className="text-xs text-muted-foreground">Stay connected with your legal team</p>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto px-2 py-0">
          <div className="flex flex-col gap-1">
            {conversations.map((conversation) => {
              const participantName = conversation.participant
                ? `${conversation.participant.first_name || ""} ${conversation.participant.last_name || ""}`.trim() ||
                (conversation.participant.user_type === "lawyer" ? "Lawyer" : "Client")
                : conversation.clientId === currentUserId
                  ? "Awaiting lawyer"
                  : "Awaiting client"

              const unread = unreadCounts[conversation.id] || 0
              const isActive = activeCaseId === conversation.id

              return (
                <button
                  key={conversation.id}
                  onClick={() => setActiveCaseId(conversation.id)}
                  className={cn(
                    "w-full text-left p-4 rounded-2xl transition-all duration-300 flex items-center gap-4 group",
                    isActive
                      ? "bg-primary shadow-lg shadow-primary/20 scale-[0.98]"
                      : "hover:bg-primary/5 hover:translate-x-1",
                  )}
                >
                  <Avatar className={cn("h-12 w-12 border-2", isActive ? "border-primary-foreground/20" : "border-background shadow-sm")}>
                    <AvatarImage src={conversation.participant?.avatar_url || undefined} />
                    <AvatarFallback className={cn(isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted")}>
                      {participantName.split(" ").map((n) => n.charAt(0)).join("").slice(0, 2).toUpperCase() || "??"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className={cn("text-sm font-bold truncate", isActive ? "text-primary-foreground" : "text-foreground")}>
                        {participantName}
                      </p>
                      {unread > 0 && !isActive && (
                        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                      )}
                    </div>
                    <p className={cn("text-xs truncate font-medium opacity-80", isActive ? "text-primary-foreground" : "text-muted-foreground")}>
                      {conversation.title}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Chat Area */}
      <div className={cn(
        "flex-1 flex flex-col h-full bg-card/10 overflow-hidden relative",
        !activeCaseId ? "hidden md:flex" : "flex"
      )}>
        {activeConversation ? (
          <>
            {/* Glass Header */}
            <div className="z-10 flex items-center justify-between px-8 py-6 border-b border-border/30 bg-background/60 backdrop-blur-xl sticky top-0">
              <div className="flex items-center gap-4">
                {activeCaseId && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="md:hidden -ml-2" 
                    onClick={() => setActiveCaseId(null)}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                )}
                <Avatar className="h-12 w-12 ring-2 ring-primary/10">
                  <AvatarImage src={activeConversation.participant?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {(activeConversation.participant?.first_name?.charAt(0) || "") +
                      (activeConversation.participant?.last_name?.charAt(0) || "") || "??"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-bold text-lg leading-none mb-1">
                    {activeConversation.participant
                      ? `${activeConversation.participant.first_name || ""} ${activeConversation.participant.last_name || ""}`.trim()
                      : "Legal Assistant"}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                    <p className="text-xs font-medium text-muted-foreground">Online • {activeConversation.title}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-background/50 text-[10px] px-3 py-1 font-bold uppercase tracking-widest border-border/50">
                  {activeConversation.status}
                </Badge>
              </div>
            </div>

            {/* Messages container */}
            <CardContent className="flex-1 overflow-y-auto p-8 scroll-smooth" id="messages-container">
              {isLoadingMessages ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary/30" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                  <div className="h-20 w-20 rounded-full bg-primary/5 flex items-center justify-center">
                    <MessageSquare className="h-8 w-8 text-primary/40" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-lg font-bold">Start the conversation</p>
                    <p className="text-sm text-muted-foreground max-w-[200px]">Send your first message to begin your legal consultation.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  {groupMessagesByDate(messages).map((group) => (
                    <div key={group.date} className="space-y-6">
                      <div className="flex justify-center sticky top-2 z-10">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 bg-background/80 backdrop-blur-md px-4 py-1.5 rounded-full border border-border/30 shadow-sm">
                          {group.date}
                        </span>
                      </div>
                      
                      <div className="space-y-4">
                        {group.messages.map((message, index) => {
                          const isOwnMessage = message.sender_id === currentUserId
                          
                          return (
                            <div 
                              key={message.id} 
                              className={cn(
                                "flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500", 
                                isOwnMessage ? "items-end" : "items-start"
                              )}
                            >
                              <div
                                className={cn(
                                  "group relative max-w-[85%] sm:max-w-[70%] rounded-[2rem] px-6 py-4 transition-all duration-300",
                                  isOwnMessage
                                    ? "bg-primary text-primary-foreground rounded-tr-none shadow-xl shadow-primary/10 hover:shadow-primary/20"
                                    : "bg-card/80 backdrop-blur-sm text-foreground rounded-tl-none border border-border/50 shadow-lg shadow-black/5"
                                )}
                              >
                                <p className="text-[15px] leading-relaxed font-medium">{message.content}</p>
                                <div className={cn(
                                  "flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-6",
                                  isOwnMessage ? "right-2" : "left-2"
                                )}>
                                  <p className="text-[10px] font-bold text-muted-foreground">
                                    {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </p>
                                  {isOwnMessage && message.is_read && (
                                    <CheckCircle2 className="h-3 w-3 text-primary" />
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                  <div id="messages-end" />
                </div>
              )}
            </CardContent>

            {/* Input Area */}
            <div className="px-8 pb-8 pt-4">
              {messagingBlocked && (
                <p className="mb-2 text-xs text-muted-foreground">
                  Messaging unlocks after your lawyer accepts this consultation request.
                </p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleAttachmentSelected}
              />
              {typingParticipant && (
                  <div className="mb-2 px-2">
                      <p className="text-[11px] text-primary font-bold italic animate-pulse flex items-center gap-2">
                          <span className="flex gap-1">
                            <span className="h-1 w-1 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                            <span className="h-1 w-1 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                            <span className="h-1 w-1 rounded-full bg-primary animate-bounce" />
                          </span>
                          {typingParticipant} is typing...
                      </p>
                  </div>
              )}

              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-primary/5 rounded-[2.5rem] blur opacity-25 group-focus-within:opacity-100 transition duration-1000 group-focus-within:duration-200"></div>
                <div className="relative flex items-center gap-3 bg-card/60 backdrop-blur-2xl border border-border/50 rounded-[2.5rem] p-2 pl-6 shadow-2xl transition-all duration-300 group-focus-within:border-primary/30">
                  <textarea
                    placeholder="Type a message..."
                    rows={1}
                    className="flex-1 bg-transparent border-none focus:ring-0 text-base py-3 resize-none max-h-32 min-h-[24px] overflow-hidden"
                    value={newMessage}
                    onChange={(event) => {
                      setNewMessage(event.target.value)
                      handleTyping()
                      // Auto-resize
                      event.target.style.height = 'inherit';
                      event.target.style.height = `${event.target.scrollHeight}px`;
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault()
                        handleSendMessage()
                      }
                    }}
                    disabled={isSending || messagingBlocked}
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={isSending || messagingBlocked}
                      className="h-12 w-12 rounded-full hover:bg-primary/5 text-muted-foreground"
                      onClick={() => fileInputRef.current?.click()}
                      title="Attach a file"
                    >
                      <Paperclip className="h-5 w-5" />
                    </Button>
                    <Button 
                      size="icon" 
                      onClick={handleSendMessage} 
                      disabled={isSending || messagingBlocked || !newMessage.trim()} 
                      className="h-12 w-12 rounded-full shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95"
                    >
                      {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-6">
             <div className="h-32 w-32 rounded-3xl bg-gradient-to-br from-primary/10 to-transparent flex items-center justify-center rotate-3 border border-primary/5">
                <MessageSquare className="h-12 w-12 text-primary/40 -rotate-3" />
             </div>
             <div className="max-w-xs space-y-2">
                <h3 className="text-xl font-bold">Your Conversations</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">Select a case from the sidebar to view messages and collaborate with your legal team.</p>
             </div>
          </div>
        )}
      </div>
    </div>
  )
}
