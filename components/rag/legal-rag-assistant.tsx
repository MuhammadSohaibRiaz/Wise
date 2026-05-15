"use client"

import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { BookOpen, Loader2, Send, Trash2, X } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type RagMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  status?: "streaming" | "done" | "error"
}

const STORAGE_KEY = "wisecase-legal-rag-chat"
const MAX_INPUT_CHARS = 3500
const STARTERS = [
  "What does the knowledge base say about murder under Pakistani criminal law?",
  "Find criminal-law sections related to theft.",
  "What does the indexed family law material say about maintenance?",
]

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function LegalRagAssistant({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<RagMessage[]>([])
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          setMessages(parsed.filter((item) => item?.role && typeof item?.content === "string"))
        }
      }
    } catch {
      sessionStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
  }, [messages])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, isSending])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const canSend = input.trim().length > 0 && !isSending
  const hasMessages = messages.length > 0

  const requestMessages = useMemo(
    () => messages.map(({ role, content }) => ({ role, content })),
    [messages],
  )

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || isSending) return

    const userMessage: RagMessage = { id: createId(), role: "user", content: trimmed }
    const assistantId = createId()
    const nextMessages = [...messages, userMessage]

    setMessages([...nextMessages, { id: assistantId, role: "assistant", content: "", status: "streaming" }])
    setInput("")
    setError(null)
    setIsSending(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await fetch("/api/legal-rag-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...requestMessages, { role: "user", content: trimmed }],
          currentPath: `${window.location.pathname}${window.location.search}`,
        }),
        signal: controller.signal,
      })

      if (!response.body) {
        throw new Error("The assistant did not return a stream.")
      }

      if (!response.ok && response.status !== 503) {
        const fallback = await response.text()
        throw new Error(fallback || "The assistant request failed.")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ""
      let lastPaint = 0

      const paint = (force = false) => {
        const now = Date.now()
        if (!force && now - lastPaint < 80) return
        lastPaint = now
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? { ...message, content: accumulated, status: "streaming" }
              : message,
          ),
        )
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        paint()
      }

      accumulated += decoder.decode()
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? { ...message, content: accumulated || "No response was returned.", status: "done" }
            : message,
        ),
      )
    } catch (caught: any) {
      if (caught?.name !== "AbortError") {
        const message = caught?.message || "The assistant is temporarily unavailable."
        setError(message)
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantId ? { ...item, content: message, status: "error" } : item,
          ),
        )
      }
    } finally {
      setIsSending(false)
      abortRef.current = null
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (input.length > MAX_INPUT_CHARS) {
      setError(`Please keep each question under ${MAX_INPUT_CHARS} characters.`)
      return
    }
    if (canSend) void sendMessage(input)
  }

  function clearChat() {
    abortRef.current?.abort()
    setMessages([])
    setError(null)
  }

  return (
    <section className="flex h-[min(76vh,640px)] w-[min(94vw,440px)] flex-col overflow-hidden rounded-lg border border-emerald-200 bg-background shadow-2xl dark:border-emerald-900">
      <header className="flex items-center justify-between border-b bg-emerald-700 px-4 py-3 text-white">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/15">
            <BookOpen className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">Legal RAG Assistant</h2>
            <p className="truncate text-xs text-emerald-50">Pakistan Legal KB</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-white/15 hover:text-white"
            onClick={clearChat}
            title="Clear chat"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-white/15 hover:text-white"
            onClick={onClose}
            title="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {!hasMessages ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-foreground">Ask from indexed Pakistani legal materials.</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                This assistant only uses the legal knowledge base. It does not read private cases or uploads.
              </p>
            </div>
            <div className="space-y-2">
              {STARTERS.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  className="w-full rounded-md border border-emerald-200 px-3 py-2 text-left text-sm transition hover:bg-emerald-50 dark:border-emerald-900 dark:hover:bg-emerald-950/40"
                  onClick={() => sendMessage(starter)}
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex",
                  message.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[86%] overflow-hidden rounded-lg px-3 py-2 text-sm leading-6",
                    message.role === "user"
                      ? "bg-emerald-700 text-white"
                      : "border bg-muted/40 text-foreground",
                    message.role === "assistant" && "min-h-[40px]",
                  )}
                >
                  {message.content ? (
                    message.status === "streaming" ? (
                      <div className="whitespace-pre-wrap break-words">{message.content}</div>
                    ) : (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                          ul: ({ children }) => <ul className="mb-2 list-disc pl-5 last:mb-0">{children}</ul>,
                          ol: ({ children }) => <ol className="mb-2 list-decimal pl-5 last:mb-0">{children}</ol>,
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    )
                  ) : (
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Searching legal KB
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error ? <div className="border-t px-4 py-2 text-xs text-destructive">{error}</div> : null}

      <form onSubmit={handleSubmit} className="border-t p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(event) => {
              setError(null)
              setInput(event.target.value.slice(0, MAX_INPUT_CHARS))
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                if (canSend) void sendMessage(input)
              }
            }}
            rows={2}
            className="max-h-28 min-h-[44px] resize-none"
            placeholder="Ask about Pakistani law..."
          />
          <Button type="submit" size="icon" disabled={!canSend} className="h-11 w-11 bg-emerald-700 hover:bg-emerald-800">
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
          Information is based on indexed legal materials and is not legal advice. {input.length}/{MAX_INPUT_CHARS}
        </p>
      </form>
    </section>
  )
}
