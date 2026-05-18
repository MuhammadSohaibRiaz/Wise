"use client"

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { BookOpen, FileText, Loader2, Mic, MicOff, Navigation, Send, Trash2, Upload, Volume2, VolumeX, X } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"
import { normalizeChatNavigationPath, type ChatRole } from "@/lib/chat-routes"
import { cn } from "@/lib/utils"

type RagMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  status?: "streaming" | "done" | "error"
}

type QueuedAnalysisJob = {
  status: string
  error_message?: string | null
  result_payload?: {
    analysis?: Record<string, unknown>
    isLegalDocument?: boolean
  } | null
}

const STORAGE_KEY = "wisecase-legal-rag-chat"
const MAX_INPUT_CHARS = 3500
const STARTERS = [
  "What does the knowledge base say about murder under Pakistani criminal law?",
  "Find lawyers for family law.",
  "Check my profile completion.",
]

function isLocalGreeting(text: string) {
  return /^(hi|hii|hello|helo|hlo|hey|yo|salam|assalamualaikum|assalamu alaikum|aoa|good\s+(morning|afternoon|evening))[\s!.,?]*$/i.test(text.trim())
}

function localGreetingResponse(role: ChatRole) {
  const audience = role === "guest" ? "I can answer general questions" : "I can help with WiseCase tasks and legal KB questions"

  return [
    "Hello. I am the WiseCase Legal RAG Assistant.",
    "",
    `${audience} from the current Pakistan Legal KB, including criminal, evidence, family, tax, labour, immigration, contract, civil procedure, and property/land materials. Authenticated users can also ask about their WiseCase profile, appointments, cases, documents, and lawyer search.`,
    "",
    'Try asking: "What is punishment for murder under Pakistani criminal law?"',
    "",
    "Disclaimer: This is general legal information only and is not legal advice.",
  ].join("\n")
}

function isLikelyPlatformQuery(text: string) {
  const normalized = text.toLowerCase()
  return (
    /\b(review|reviews|rating|profile|appointment|appointments|dashboard|settings|sign in|sign up|register|fees|refund|privacy|verification|upload|analyze document|analyse document)\b/.test(normalized) ||
    /\b(lawyer|lawyers|advocate|advocates|wisecase)\b/.test(normalized) ||
    /(?:\u0648\u06A9\u06CC\u0644|\u0648\u06A9\u0644\u0627\u0621|\u0644\u0627\u0626\u0631|\u0644\u0627\u0626\u06CC\u0631|\u0627\u067E\u0648\u0627\u0626\u0646\u0679\u0645\u0646\u0679|\u0627\u067E\u0627\u0626\u0646\u0679\u0645\u0646\u0679|\u067E\u0631\u0648\u0641\u0627\u0626\u0644|\u0641\u06CC\u0633|\u0645\u0639\u0627\u0648\u0636\u06C1|\u0631\u06CC\u0641\u0646\u0688|\u06A9\u06CC\u0633\s+\u062F\u06A9\u06BE\u0627\u0624|\u0645\u06CC\u0631\u06D2\s+\u06A9\u06CC\u0633)/.test(text)
  )
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function stripControlMarkers(text: string) {
  return text
    .replace(/\[NAVIGATE:.*?\]/g, "")
    .replace(/\[VIEW_ANALYSIS:.*?\]/g, "")
    .replace(/\[ACTION:.*?:.*?\]/g, "")
    .trim()
}

function sanitizeAssistantText(text: string) {
  return text
    .replace(/\u6CD5\u5F8B\u06CC/g, "\u0642\u0627\u0646\u0648\u0646\u06CC")
    .replace(/\u6CD5\u5F8B/g, "\u0642\u0627\u0646\u0648\u0646")
    .replace(/\bqisas\b/gi, "\u0642\u0635\u0627\u0635")
    .replace(/\bta'?zir\b/gi, "\u062A\u0639\u0632\u06CC\u0631")
    .replace(/\bqatl[-\s]?[ei]?[-\s]?amd\b/gi, "\u0642\u062A\u0644 \u0639\u0645\u062F")
    .replace(/[\u3400-\u9FFF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF]/g, "")
    .replace(/\s{2,}/g, " ")
}

function prepareSpeechText(text: string) {
  return sanitizeAssistantText(stripControlMarkers(text))
    .replace(/^Searching Pakistani legal knowledge base\.\.\.\s*/i, "")
    .replace(/^The first response was too large for the current AI token limit\. Retrying with shorter legal context\.\.\.\s*/im, "")
    .replace(/\[\d+\]/g, "")
    .replace(/(?:^|\n)\s*(?:legal\s+)?disclaimer:.*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function getPreferredSpeechLanguage(text: string) {
  if (/[\u0600-\u06FF]/.test(text)) return "ur-PK"
  if (typeof navigator !== "undefined") {
    const languages = navigator.languages?.length ? navigator.languages : [navigator.language]
    const browserLanguage = languages.find(Boolean)
    if (languages.some((language) => language?.toLowerCase().startsWith("ur"))) return "ur-PK"
    if (browserLanguage) return browserLanguage
  }
  return "en-US"
}

function isVoiceLanguage(value: string | null): value is "en-US" | "ur-PK" {
  return value === "en-US" || value === "ur-PK"
}

function normalizeIndicDigits(text: string) {
  const digits: Record<string, string> = {
    "\u0660": "0",
    "\u06F0": "0",
    "\u0661": "1",
    "\u06F1": "1",
    "\u0662": "2",
    "\u06F2": "2",
    "\u0663": "3",
    "\u06F3": "3",
    "\u0664": "4",
    "\u06F4": "4",
    "\u0665": "5",
    "\u06F5": "5",
    "\u0666": "6",
    "\u06F6": "6",
    "\u0667": "7",
    "\u06F7": "7",
    "\u0668": "8",
    "\u06F8": "8",
    "\u0669": "9",
    "\u06F9": "9",
  }

  return text.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (digit) => digits[digit] || digit)
}

function normalizeVoiceTranscript(text: string) {
  const normalized = normalizeIndicDigits(text)
    .replace(/\bmord\s+guage\b/gi, "mortgage")
    .replace(/\bmort\s+gage\b/gi, "mortgage")
    .replace(/\bmorgage\b/gi, "mortgage")
    .replace(/\bmortage\b/gi, "mortgage")
    .replace(/\bmortgages\b/gi, "mortgages")
    .replace(/\bproperty\s+egg\b/gi, "Property Act")
    .replace(/\btransfer\s+property\s+act\b/gi, "Transfer of Property Act")
    .replace(/\btransfer\s+of\s+property\s+egg\b/gi, "Transfer of Property Act")
    .replace(/\bqanun\s+e\s+shahadat\b/gi, "Qanun-e-Shahadat")
    .replace(/\bqanoon\s+e\s+shahadat\b/gi, "Qanun-e-Shahadat")
    .replace(/\bpakistan\s+panel\s+code\b/gi, "Pakistan Penal Code")
    .replace(/\bpenal\s+court\b/gi, "Penal Code")
    .replace(/\bsection\s+three\s+zero\s+two\b/gi, "Section 302")
    .replace(/\bsection\s+three\s+seventy\s+eight\b/gi, "Section 378")
    .replace(/\bsection\s+three\s+seventy\s+nine\b/gi, "Section 379")
    .replace(/(?:\u062F\u0627\u0641\u0639\u06C1|\u062F\u0641\u0639\u0627|\u062F\u0641\u0639)(?=\s|$)/g, "\u062F\u0641\u0639\u06C1")
    .replace(/\u062F\u0641\u0639\u06C1\s+(?:\u062A\u06CC\u0646\s+\u0633\u0648\s+\u062F\u0648|\u062A\u06CC\u0646\s+\u0635\u0641\u0631\s+\u062F\u0648|\u062A\u06BE\u0631\u06CC\s+\u0632\u06CC\u0631\u0648\s+\u0679\u0648)/g, "\u062F\u0641\u0639\u06C1 302")
    .replace(/\u0633\u06CC\u06A9\u0634\u0646\s+(?:\u062A\u06CC\u0646\s+\u0633\u0648\s+\u062F\u0648|\u062A\u06CC\u0646\s+\u0635\u0641\u0631\s+\u062F\u0648|\u062A\u06BE\u0631\u06CC\s+\u0632\u06CC\u0631\u0648\s+\u0679\u0648)/g, "\u062F\u0641\u0639\u06C1 302")
    .replace(/\u062F\u0641\u0639\u06C1\s+(?:\u062A\u06CC\u0646\s+\u0633\u0648\s+\u0627\u0679\u06BE\u0627\u062A\u0631|\u062A\u06CC\u0646\s+\u0633\u0648\s+\u0627\u06CC\u06A9\u06C1\u062A\u0631|\u062A\u06CC\u0646\s+\u0633\u0648\s+\u0627\u06CC\u06A9\u0627\u0633\u06CC)/g, "\u062F\u0641\u0639\u06C1 378")
    .replace(/\u06A9\u0627\u0646\u0648\u0646/g, "\u0642\u0627\u0646\u0648\u0646")
    .replace(/\u067E\u0627\u06A9\u0633\u062A\u0627\u0646\u06CC\s+\u06A9\u0627\u0646\u0648\u0646/g, "\u067E\u0627\u06A9\u0633\u062A\u0627\u0646\u06CC \u0642\u0627\u0646\u0648\u0646")
    .replace(/\u0632\u0645\u0627\u0646\u062A/g, "\u0636\u0645\u0627\u0646\u062A")
    .replace(/\u06A9\u062A\u0644/g, "\u0642\u062A\u0644")
    .replace(/\u0642\u0627\u0646\u0648\u0646\s+[\u06CC\u0650]?\s*\u0634\u06C1\u0627\u062F\u062A/g, "\u0642\u0627\u0646\u0648\u0646 \u0634\u06C1\u0627\u062F\u062A")
    .replace(/\u0642\u0627\u0646\u0648\u0646\s+\u0634\u06C1\u0627\u062F\u062A/g, "\u0642\u0627\u0646\u0648\u0646 \u0634\u06C1\u0627\u062F\u062A")
    .replace(/\u0642\u0635\u0627\u0633|\u06A9\u0635\u0627\u0635/g, "\u0642\u0635\u0627\u0635")
    .replace(/\u062A\u0627\u0632\u06CC\u0631|\u062A\u0632\u06CC\u0631/g, "\u062A\u0639\u0632\u06CC\u0631")
    .replace(/\u0642\u062A\u0644\s+\u0627\u0645\u062F|\u0642\u062A\u0644\s+\u0639\u0627\u0645\u062F/g, "\u0642\u062A\u0644 \u0639\u0645\u062F")
    .replace(/\s{2,}/g, " ")
    .trim()

  if (/^(the\s+13|the\s+thirteen|13|thirteen)$/i.test(normalized)) {
    return "\u062F\u0641\u0639\u06C1 302"
  }

  return normalized
}

function selectSpeechVoice(text: string) {
  if (typeof window === "undefined") return null
  const voices = window.speechSynthesis?.getVoices?.() || []
  if (!voices.length) return null

  const preferredLanguage = getPreferredSpeechLanguage(text).toLowerCase()
  const languagePrefix = preferredLanguage.split("-")[0]
  const lower = (value: string) => value.toLowerCase()

  return (
    voices.find((voice) => lower(voice.lang) === preferredLanguage) ||
    voices.find((voice) => lower(voice.lang).startsWith(languagePrefix)) ||
    (languagePrefix === "ur" ? voices.find((voice) => /^hi\b|^ar\b/i.test(voice.lang)) : null) ||
    null
  )
}

export function LegalRagAssistant({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [messages, setMessages] = useState<RagMessage[]>([])
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [chatRole, setChatRole] = useState<ChatRole>("guest")
  const [userId, setUserId] = useState<string | null>(null)
  const [historyReady, setHistoryReady] = useState(false)
  const [historyCursor, setHistoryCursor] = useState<string | null>(null)
  const [hasMoreHistory, setHasMoreHistory] = useState(false)
  const [isLoadingOlderHistory, setIsLoadingOlderHistory] = useState(false)
  const [isClearingHistory, setIsClearingHistory] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeechSupported, setIsSpeechSupported] = useState(false)
  const [voiceLanguage, setVoiceLanguage] = useState<"en-US" | "ur-PK">("ur-PK")
  const [shouldReadAloud, setShouldReadAloud] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [pendingNavigationPath, setPendingNavigationPath] = useState<string | null>(null)
  const [isRoutePending, startRouteTransition] = useTransition()
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<any>(null)
  const voiceBaseInputRef = useRef("")
  const shouldScrollToLatestOnOpenRef = useRef(false)
  const pendingAssistantScrollIdRef = useRef<string | null>(null)

  const caseIdFromQuery = searchParams.get("case")
  const caseIdFromPath = pathname.match(/\/(?:client|lawyer)\/cases\/([0-9a-fA-F-]{36})(?:\/|$)/)?.[1] ?? null
  const activeCaseId = caseIdFromQuery || caseIdFromPath
  const historyContextPath = activeCaseId ? `/cases/${activeCaseId}` : "global"

  const requestMessages = useMemo(
    () => messages.filter((message) => message.status !== "streaming").map(({ role, content }) => ({ role, content })),
    [messages],
  )

  const buildHistoryParams = useCallback(
    (opts?: { before?: string; limit?: number }) => {
      const params = new URLSearchParams()
      params.set("currentPath", historyContextPath)
      params.set("limit", String(opts?.limit ?? 80))
      if (activeCaseId) params.set("caseId", activeCaseId)
      if (opts?.before) params.set("before", opts.before)
      return params
    },
    [activeCaseId, historyContextPath],
  )

  useEffect(() => {
    let cancelled = false

    async function loadRoleAndHistory() {
      setHistoryReady(false)
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          setUserId(null)
          setChatRole("guest")
          const stored = sessionStorage.getItem(STORAGE_KEY)
          if (stored) {
            const parsed = JSON.parse(stored)
            if (!cancelled && Array.isArray(parsed)) {
              setMessages(parsed.filter((item) => item?.role && typeof item?.content === "string"))
              shouldScrollToLatestOnOpenRef.current = true
            }
          } else if (!cancelled) {
            setMessages([])
          }
          return
        }

        setUserId(user.id)
        const { data: profile } = await supabase.from("profiles").select("user_type").eq("id", user.id).maybeSingle()
        const role = profile?.user_type === "lawyer" ? "lawyer" : "client"
        if (!cancelled) setChatRole(role)

        const res = await fetch(`/api/chat/history?${buildHistoryParams().toString()}`)
        if (res.ok) {
          const payload = await res.json()
          const history = (payload.messages || []).map((message: any) => ({
            id: message.id || createId(),
            role: message.role,
            content: message.content || "",
            status: "done",
          }))
          if (!cancelled) {
            setMessages(history.filter((message: RagMessage) => message.role === "user" || message.role === "assistant"))
            setHasMoreHistory(Boolean(payload.hasMore))
            setHistoryCursor(payload.nextCursor || null)
            shouldScrollToLatestOnOpenRef.current = true
          }
        }
      } catch (caught) {
        console.error("[LegalRAG:UI] Failed to load history:", caught)
        if (!cancelled) setError("Failed to load chat history.")
      } finally {
        if (!cancelled) setHistoryReady(true)
      }
    }

    void loadRoleAndHistory()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!historyReady || userId) return
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
  }, [historyReady, messages, userId])

  useEffect(() => {
    if (!historyReady || !shouldScrollToLatestOnOpenRef.current) return
    shouldScrollToLatestOnOpenRef.current = false

    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "auto" })
    })
  }, [historyReady])

  useEffect(() => {
    if (typeof window === "undefined") return
    const storedVoiceLanguage = window.localStorage.getItem("wisecase-rag-voice-language")
    if (isVoiceLanguage(storedVoiceLanguage)) setVoiceLanguage(storedVoiceLanguage)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem("wisecase-rag-voice-language", voiceLanguage)
  }, [voiceLanguage])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      if (typeof window !== "undefined") window.speechSynthesis?.cancel()
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    if (!SpeechRecognition) {
      setIsSpeechSupported(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    recognition.lang = voiceLanguage
    recognition.onstart = () => {
      setError(null)
      setIsListening(true)
    }
    recognition.onresult = (event: any) => {
      let finalTranscript = ""
      let interimTranscript = ""

      for (let index = 0; index < event.results.length; index += 1) {
        const transcript = event.results[index]?.[0]?.transcript || ""
        if (event.results[index]?.isFinal) finalTranscript += transcript
        else interimTranscript += transcript
      }

      const transcript = normalizeVoiceTranscript(finalTranscript || interimTranscript)
      if (transcript) {
        const prefix = voiceBaseInputRef.current ? `${voiceBaseInputRef.current} ` : ""
        setInput(`${prefix}${transcript}`.slice(0, MAX_INPUT_CHARS))
      }

      if (finalTranscript) setIsListening(false)
    }
    recognition.onerror = (event: any) => {
      setIsListening(false)
      const errorCode = String(event?.error || "")
      if (errorCode === "no-speech") {
        setError("I did not hear anything. Please try speaking again.")
      } else if (errorCode === "not-allowed" || errorCode === "service-not-allowed") {
        setError("Microphone access is blocked. Please allow microphone permission in your browser.")
      } else if (errorCode === "network") {
        setError("Voice input is temporarily unavailable. Please type your message.")
      }
    }
    recognition.onend = () => setIsListening(false)
    recognitionRef.current = recognition
    setIsSpeechSupported(true)

    return () => {
      try {
        recognition.stop()
      } catch {
        // Browser may throw if recognition is already stopped.
      }
      recognitionRef.current = null
      setIsSpeechSupported(false)
    }
  }, [voiceLanguage])

  const normalizePath = useCallback((path: string | null | undefined) => {
    if (!path) return null
    return normalizeChatNavigationPath(path, chatRole)
  }, [chatRole])

  const isAllowedAction = useCallback(
    (label: string, path: string) => {
      if (/^https?:\/\//i.test(path) || path.startsWith("//") || /^www\./i.test(path)) return false
      const normalized = normalizePath(path)
      if (!normalized || !normalized.startsWith("/") || /\/https?:\/\//i.test(normalized)) return false
      const blocked = ["doctor", "surgeon", "hospital", "clinic", "medicine", "heart"]
      if (blocked.some((term) => label.toLowerCase().includes(term))) return false
      const allowedPrefixes = ["/match", "/client/", "/lawyer/", "/admin/", "/auth/", "/register", "/terms", "/privacy"]
      return allowedPrefixes.some((prefix) => normalized === prefix || normalized.startsWith(prefix))
    },
    [normalizePath],
  )

  const navigateWithFeedback = useCallback(
    (path: string) => {
      const normalized = normalizePath(path)
      if (!normalized) return
      setPendingNavigationPath(normalized)
      startRouteTransition(() => router.push(normalized))
      window.setTimeout(() => {
        setPendingNavigationPath((current) => (current === normalized ? null : current))
      }, 2000)
    },
    [normalizePath, router],
  )

  useEffect(() => {
    if (pendingNavigationPath) setPendingNavigationPath(null)
  }, [pathname])

  const speak = useCallback((text: string, force = false) => {
    if ((!force && !shouldReadAloud) || typeof window === "undefined" || !text.trim()) return
    window.speechSynthesis.cancel()
    const speechText = prepareSpeechText(text)
    if (!speechText) return
    const utterance = new SpeechSynthesisUtterance(speechText)
    utterance.lang = getPreferredSpeechLanguage(speechText)
    const voice = selectSpeechVoice(speechText)
    if (voice) utterance.voice = voice
    utterance.rate = /[\u0600-\u06FF]/.test(speechText) ? 0.9 : 1
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }, [shouldReadAloud])

  const latestAssistantMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant" && message.status !== "streaming" && stripControlMarkers(message.content).trim()),
    [messages],
  )

  const toggleReadAloud = useCallback(() => {
    if (typeof window === "undefined") return

    if (shouldReadAloud || isSpeaking) {
      setShouldReadAloud(false)
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
      return
    }

    setShouldReadAloud(true)
    if (latestAssistantMessage?.content) {
      speak(latestAssistantMessage.content, true)
    }
  }, [isSpeaking, latestAssistantMessage, shouldReadAloud, speak])

  const toggleVoiceInput = useCallback(() => {
    const recognition = recognitionRef.current
    if (!recognition) {
      setError("Voice input is not supported in this browser. Please use Chrome or Edge.")
      return
    }

    if (isListening) {
      recognition.stop()
      setIsListening(false)
      return
    }

    try {
      setError(null)
      voiceBaseInputRef.current = input.trim()
      recognition.lang = /[\u0600-\u06FF]/.test(input) ? getPreferredSpeechLanguage(input) : voiceLanguage
      recognition.start()
    } catch {
      setIsListening(false)
      setError("Voice input could not start. Please try again.")
    }
  }, [input, isListening, voiceLanguage])

  function startNewConversation() {
    abortRef.current?.abort()
    window.speechSynthesis?.cancel()
    setError(null)
    setIsSearching(false)
    setShowClearConfirm(false)
    setMessages([])
    setHasMoreHistory(false)
    setHistoryCursor(null)
    if (!userId) sessionStorage.removeItem(STORAGE_KEY)
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  function scrollAssistantStartIntoView(messageId: string) {
    requestAnimationFrame(() => {
      const container = scrollRef.current
      const bubble = container?.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`)
      if (!container || !bubble) return

      const containerRect = container.getBoundingClientRect()
      const bubbleRect = bubble.getBoundingClientRect()
      const topPadding = 12
      const targetTop = container.scrollTop + (bubbleRect.top - containerRect.top) - topPadding

      container.scrollTo({
        top: Math.max(0, targetTop),
        behavior: "smooth",
      })
    })
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || isSending || isUploading) return

    const userMessage: RagMessage = { id: createId(), role: "user", content: trimmed, status: "done" }
    const assistantId = createId()
    const nextMessages = [...messages, userMessage]
    const shouldShowLegalSearchStatus = !isLikelyPlatformQuery(trimmed)

    if (isLocalGreeting(trimmed)) {
      const response = localGreetingResponse(chatRole)
      setMessages([...nextMessages, { id: assistantId, role: "assistant", content: response, status: "done" }])
      setInput("")
      setError(null)
      window.setTimeout(() => inputRef.current?.focus(), 0)
      window.setTimeout(() => scrollAssistantStartIntoView(assistantId), 0)
      speak(response)
      return
    }

    pendingAssistantScrollIdRef.current = assistantId
    setMessages([...nextMessages, { id: assistantId, role: "assistant", content: "", status: "streaming" }])
    setInput("")
    window.setTimeout(() => inputRef.current?.focus(), 0)
    setError(null)
    setIsSending(true)
    setIsSearching(shouldShowLegalSearchStatus)

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

      const textStream = response.body
      if (!textStream) throw new Error(await response.text().catch(() => "The assistant did not return a response."))

      const reader = textStream.getReader()
      const decoder = new TextDecoder()
      let accumulated = ""
      let lastPaint = 0

      const paint = (force = false) => {
        const now = Date.now()
        if (!force && now - lastPaint < 90) return
        lastPaint = now
        const displayText = sanitizeAssistantText(accumulated)
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId ? { ...message, content: displayText, status: "streaming" } : message,
          ),
        )
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        if (chunk) setIsSearching(false)
        accumulated += chunk
        paint()
        if (pendingAssistantScrollIdRef.current === assistantId && accumulated.trim()) {
          pendingAssistantScrollIdRef.current = null
          scrollAssistantStartIntoView(assistantId)
        }
      }

      accumulated += decoder.decode()
      setIsSearching(false)
      if (!response.ok) throw new Error(accumulated || "The assistant request failed.")

      const finalText = sanitizeAssistantText(accumulated).trim() || [
        "I found no generated text for that request.",
        "",
        "Please try again with a slightly more specific Pakistani legal question, such as a section number, offence, procedure, or statute name.",
        "",
        "Disclaimer: This is general legal information only and is not legal advice.",
      ].join("\n")
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId ? { ...message, content: finalText, status: "done" } : message,
        ),
      )
      if (pendingAssistantScrollIdRef.current === assistantId) {
        pendingAssistantScrollIdRef.current = null
        window.setTimeout(() => scrollAssistantStartIntoView(assistantId), 0)
      }
      speak(finalText)
    } catch (caught: any) {
      if (caught?.name !== "AbortError") {
        const message = caught?.message || "The assistant is temporarily unavailable."
        setError(message)
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantId ? { ...item, content: message, status: "error" } : item,
          ),
        )
        if (pendingAssistantScrollIdRef.current === assistantId) {
          pendingAssistantScrollIdRef.current = null
          window.setTimeout(() => scrollAssistantStartIntoView(assistantId), 0)
        }
      }
    } finally {
      setIsSending(false)
      setIsSearching(false)
      abortRef.current = null
      window.setTimeout(() => inputRef.current?.focus(), 0)
    }
  }

  async function loadOlderHistory() {
    if (!historyCursor || isLoadingOlderHistory) return
    setIsLoadingOlderHistory(true)
    try {
      const res = await fetch(`/api/chat/history?${buildHistoryParams({ before: historyCursor }).toString()}`)
      if (!res.ok) throw new Error("Failed to load older messages.")
      const payload = await res.json()
      const older = (payload.messages || []).map((message: any) => ({
        id: message.id || createId(),
        role: message.role,
        content: message.content || "",
        status: "done",
      }))
      setMessages((current) => [...older, ...current])
      setHasMoreHistory(Boolean(payload.hasMore))
      setHistoryCursor(payload.nextCursor || null)
    } catch (caught: any) {
      setError(caught?.message || "Failed to load older messages.")
    } finally {
      setIsLoadingOlderHistory(false)
    }
  }

  async function clearChat() {
    abortRef.current?.abort()
    window.speechSynthesis?.cancel()
    setError(null)
    setIsSearching(false)
    setShowClearConfirm(false)
    setMessages([])
    setHasMoreHistory(false)
    setHistoryCursor(null)
    sessionStorage.removeItem(STORAGE_KEY)

    if (!userId) {
      return
    }

    setIsClearingHistory(true)
    try {
      const params = buildHistoryParams()
      if (!activeCaseId) params.set("scope", "global")
      const res = await fetch(`/api/chat/history?${params.toString()}`, { method: "DELETE" })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || "Failed to clear chat history.")
    } catch (caught: any) {
      setError(caught?.message || "Failed to clear chat history.")
    } finally {
      setIsClearingHistory(false)
    }
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setError(null)
    const supabase = createClient()

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Please sign in to upload and analyze documents.")

      const fileExt = file.name.split(".").pop()
      const fileName = `${crypto.randomUUID()}.${fileExt ?? "bin"}`
      const filePath = `${user.id}/${fileName}`

      const { error: uploadError } = await supabase.storage.from("documents").upload(filePath, file)
      if (uploadError) throw uploadError

      const {
        data: { publicUrl },
      } = supabase.storage.from("documents").getPublicUrl(filePath)

      const { data: doc, error: docError } = await supabase
        .from("documents")
        .insert({
          uploaded_by: user.id,
          file_name: file.name,
          file_url: publicUrl,
          file_type: file.type,
          status: "pending",
        })
        .select()
        .single()

      if (docError) throw docError

      const uploadMessage: RagMessage = { id: createId(), role: "user", content: `Uploaded document: ${file.name}`, status: "done" }
      const analyzingMessage: RagMessage = {
        id: createId(),
        role: "assistant",
        content: `I've received **${file.name}**. Analyzing it now...`,
        status: "done",
      }
      setMessages((current) => [...current, uploadMessage, analyzingMessage])

      const res = await fetch("/api/analyze-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: doc.id, async: true }),
      })

      const analysisData = await res.json()
      if (!res.ok) throw new Error(analysisData.error || "Analysis failed.")

      let finalPayload = analysisData
      if (analysisData.queued && analysisData.jobId) {
        let lastJob: QueuedAnalysisJob | null = null
        for (let i = 0; i < 150; i++) {
          const jobRes = await fetch(`/api/analyze-document/job/${analysisData.jobId}`)
          const jobData = await jobRes.json()
          if (!jobRes.ok) throw new Error(jobData.error || "Failed to check analysis job.")
          lastJob = jobData as QueuedAnalysisJob
          if (lastJob.status === "completed" || lastJob.status === "failed") break
          await new Promise((resolve) => setTimeout(resolve, 2000))
        }

        if (!lastJob || lastJob.status !== "completed" || !lastJob.result_payload?.analysis) {
          throw new Error(lastJob?.error_message || "Analysis did not complete successfully.")
        }

        finalPayload = {
          analysis: lastJob.result_payload.analysis,
          isLegalDocument: lastJob.result_payload.isLegalDocument !== false,
        }
      }

      const analysis = (finalPayload.analysis || {}) as Record<string, unknown>
      const legalCitations = Array.isArray(analysis.legal_citations) ? analysis.legal_citations.map(String) : []
      const citations = legalCitations.length ? `\n\n**Relevant Pakistani Law:**\n- ${legalCitations.join("\n- ")}` : ""
      const summary = typeof analysis.summary === "string" ? analysis.summary : "No summary available."
      const riskLevel = typeof analysis.risk_level === "string" ? analysis.risk_level : "Unknown"
      const disclaimerText = typeof analysis.disclaimer === "string" ? analysis.disclaimer : ""
      const disclaimer = disclaimerText ? `\n\n> [!IMPORTANT]\n> ${disclaimerText}` : ""
      const analysisContent = `### Analysis Complete for ${file.name}\n\n**Summary:** ${summary}\n\n**Risk Level:** ${riskLevel}${citations}${disclaimer}\n\n[VIEW_ANALYSIS:${doc.id}]`

      setMessages((current) => [...current, { id: createId(), role: "assistant", content: analysisContent, status: "done" }])
      speak(analysisContent)

      await Promise.all([
        supabase.from("ai_chat_messages").insert({
          user_id: user.id,
          case_id: activeCaseId,
          role: "user",
          content: `Uploaded document: ${file.name}`,
        }),
        supabase.from("ai_chat_messages").insert({
          user_id: user.id,
          case_id: activeCaseId,
          role: "assistant",
          content: analyzingMessage.content,
        }),
        supabase.from("ai_chat_messages").insert({
          user_id: user.id,
          case_id: activeCaseId,
          role: "assistant",
          content: analysisContent,
        }),
      ])
    } catch (caught: any) {
      const message = caught?.message || "Document upload or analysis failed."
      setError(message)
      setMessages((current) => [...current, { id: createId(), role: "assistant", content: `Sorry, I encountered an error: ${message}`, status: "error" }])
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (input.length > MAX_INPUT_CHARS) {
      setError(`Please keep each question under ${MAX_INPUT_CHARS} characters.`)
      return
    }
    void sendMessage(input)
  }

  const canSend = input.trim().length > 0 && !isSending && !isUploading && historyReady

  return (
    <section className="flex h-[min(78vh,680px)] w-[min(94vw,460px)] flex-col overflow-hidden rounded-lg border border-emerald-200 bg-background shadow-2xl dark:border-emerald-900">
      <header className="flex items-center justify-between border-b bg-emerald-700 px-4 py-3 text-white">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/15">
            <BookOpen className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">Legal RAG Assistant</h2>
            <p className="truncate text-xs text-emerald-50">Pakistan Legal KB + WiseCase tools</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-white/15 hover:text-white"
            onClick={toggleReadAloud}
            title={shouldReadAloud || isSpeaking ? "Stop reading aloud" : "Read latest and future responses aloud"}
          >
            {shouldReadAloud || isSpeaking ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 opacity-70" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-white/15 hover:text-white"
            onClick={startNewConversation}
            title="New conversation"
            disabled={isClearingHistory}
          >
            <BookOpen className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-white/15 hover:text-white"
            onClick={() => setShowClearConfirm(true)}
            title="Clear chat"
            disabled={isClearingHistory || showClearConfirm}
          >
            {isClearingHistory ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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

      {isRoutePending ? (
        <div className="h-1 w-full bg-emerald-100">
          <div className="h-full w-1/3 animate-pulse bg-emerald-700" />
        </div>
      ) : null}

      {showClearConfirm ? (
        <div className="flex items-center justify-between gap-3 border-b bg-amber-50 px-4 py-2 text-xs text-amber-900">
          <span>Clear this chat?</span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => setShowClearConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 bg-amber-700 px-2 text-xs text-white hover:bg-amber-800"
              onClick={() => void clearChat()}
              disabled={isClearingHistory}
            >
              {isClearingHistory ? "Clearing..." : "Clear"}
            </Button>
          </div>
        </div>
      ) : null}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {!historyReady ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-7 w-7 animate-spin" />
            Loading assistant history
          </div>
        ) : !messages.length ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-foreground">Ask legal KB questions or WiseCase account tasks.</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Legal answers use indexed Pakistani materials. Personal case, profile, appointment, and document tasks require sign-in.
              </p>
            </div>
            <div className="space-y-2">
              {STARTERS.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  className="w-full rounded-md border border-emerald-200 px-3 py-2 text-left text-sm transition hover:bg-emerald-50 dark:border-emerald-900 dark:hover:bg-emerald-950/40"
                  onClick={() => void sendMessage(starter)}
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {hasMoreHistory ? (
              <div className="flex justify-center">
                <Button variant="outline" size="sm" onClick={() => void loadOlderHistory()} disabled={isLoadingOlderHistory}>
                  {isLoadingOlderHistory ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Load older messages
                </Button>
              </div>
            ) : null}

            {messages.map((message) => {
              if (!message.content && message.status === "streaming" && isSearching) return null

              const actionMarkers = [...message.content.matchAll(/\[ACTION:(.*?):(.*?)\]/g)]
                .map((match) => ({ label: match[1], path: match[2] }))
                .filter((action) => isAllowedAction(action.label, action.path))
              const viewAnalysisId = message.content.match(/\[VIEW_ANALYSIS:(.*?)\]/)?.[1]
              const navPath = normalizePath(message.content.match(/\[NAVIGATE:(.*?)\]/)?.[1])
              const cleanText = sanitizeAssistantText(stripControlMarkers(message.content))
              const displayContent = sanitizeAssistantText(message.content)

              return (
                <div key={message.id} data-message-id={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[86%] overflow-hidden rounded-lg px-3 py-2 text-sm leading-6", message.role === "user" ? "bg-emerald-700 text-white" : "border bg-muted/40 text-foreground")}>
                    {displayContent ? (
                      message.status === "streaming" ? (
                        <div className="whitespace-pre-wrap break-words">{displayContent}</div>
                      ) : (
                        <>
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                              ul: ({ children }) => <ul className="mb-2 list-disc pl-5 last:mb-0">{children}</ul>,
                              ol: ({ children }) => <ol className="mb-2 list-decimal pl-5 last:mb-0">{children}</ol>,
                              code: ({ children }) => <code className="rounded bg-background/70 px-1 py-0.5 text-xs">{children}</code>,
                            }}
                          >
                            {cleanText || displayContent}
                          </ReactMarkdown>
                          {message.role === "assistant" ? (
                            <div className="mt-2 flex flex-col gap-2">
                              {viewAnalysisId ? (
                                <Button size="sm" className="h-8 justify-between text-xs" onClick={() => navigateWithFeedback(`/client/analysis?documentId=${viewAnalysisId}`)}>
                                  View Analysis
                                  <FileText className="h-3 w-3" />
                                </Button>
                              ) : null}
                              {actionMarkers.map((action, index) => {
                                const normalized = normalizePath(action.path) || action.path
                                return (
                                  <Button key={`${action.path}-${index}`} variant="outline" size="sm" className="h-8 justify-between text-xs" onClick={() => navigateWithFeedback(action.path)} disabled={isRoutePending}>
                                    {pendingNavigationPath === normalized ? "Opening..." : action.label}
                                    {pendingNavigationPath === normalized ? <Loader2 className="h-3 w-3 animate-spin" /> : <Navigation className="h-3 w-3 opacity-60" />}
                                  </Button>
                                )
                              })}
                              {navPath && !viewAnalysisId && !actionMarkers.length ? (
                                <Button variant="secondary" size="sm" className="h-8 justify-between text-xs" onClick={() => navigateWithFeedback(navPath)} disabled={isRoutePending}>
                                  {pendingNavigationPath === navPath ? "Opening..." : "Go to Page"}
                                  {pendingNavigationPath === navPath ? <Loader2 className="h-3 w-3 animate-spin" /> : <Navigation className="h-3 w-3" />}
                                </Button>
                              ) : null}
                            </div>
                          ) : null}
                        </>
                      )
                    ) : (
                      <span className="inline-flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {isUploading ? "Analyzing document" : "Thinking"}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {isSearching ? (
        <div className="border-t px-4 py-2 text-xs italic text-muted-foreground">
          <span className="inline-flex animate-pulse items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Searching Pakistani legal knowledge base...
          </span>
        </div>
      ) : null}

      {error ? <div className="border-t px-4 py-2 text-xs text-destructive">{error}</div> : null}

      <form onSubmit={handleSubmit} className="border-t p-3">
        <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileUpload} />
        <div className="flex items-end gap-2">
          <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0" onClick={() => fileInputRef.current?.click()} disabled={isUploading || !historyReady} title="Upload legal document">
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 shrink-0 px-2 text-xs font-semibold"
            onClick={() => setVoiceLanguage((current) => (current === "ur-PK" ? "en-US" : "ur-PK"))}
            disabled={isListening || isUploading || !historyReady}
            title={voiceLanguage === "ur-PK" ? "Voice language: Urdu. Click for English." : "Voice language: English. Click for Urdu."}
          >
            {voiceLanguage === "ur-PK" ? "UR" : "EN"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn("h-11 w-11 shrink-0", isListening && "text-emerald-700")}
            onClick={toggleVoiceInput}
            disabled={!isSpeechSupported || isUploading || !historyReady}
            title={isListening ? "Stop listening" : "Voice input"}
          >
            {isListening ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </Button>
          <Textarea
            ref={inputRef}
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
            placeholder={isListening ? "Listening..." : "Ask about Pakistani law or WiseCase..."}
            disabled={isSending || isUploading || !historyReady}
          />
          <Button type="submit" size="icon" disabled={!canSend} className="h-11 w-11 bg-emerald-700 hover:bg-emerald-800">
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
          Legal KB answers are not legal advice. Personal WiseCase tasks require sign-in. {input.length}/{MAX_INPUT_CHARS}
        </p>
      </form>
    </section>
  )
}
