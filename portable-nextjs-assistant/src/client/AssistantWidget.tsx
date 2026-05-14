'use client'

import { useMemo, useRef, useState } from 'react'

type ChatRole = 'user' | 'assistant'

type ChatMessage = {
  id: string
  role: ChatRole
  content: string
}

type AssistantWidgetProps = {
  apiPath?: string
  title?: string
  greeting?: string
  storageKey?: string
  userContext?: Record<string, unknown>
}

export function AssistantWidget({
  apiPath = '/api/assistant',
  title = 'AI Assistant',
  greeting = 'Hello! How can I help you today?',
  storageKey = 'portable-assistant-messages',
  userContext,
}: AssistantWidgetProps) {
  const initialMessages = useMemo<ChatMessage[]>(() => {
    if (typeof window === 'undefined') {
      return [{ id: 'greeting', role: 'assistant', content: greeting }]
    }
    try {
      const raw = sessionStorage.getItem(storageKey)
      if (!raw) return [{ id: 'greeting', role: 'assistant', content: greeting }]
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return [{ id: 'greeting', role: 'assistant', content: greeting }]
      return parsed
    } catch {
      return [{ id: 'greeting', role: 'assistant', content: greeting }]
    }
  }, [greeting, storageKey])

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const persist = (next: ChatMessage[]) => {
    setMessages(next)
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        // ignore
      }
    }
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 0)
  }

  const onSend = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: text }
    const assistantMsg: ChatMessage = { id: `a-${Date.now()}`, role: 'assistant', content: '' }

    const optimistic = [...messages, userMsg, assistantMsg]
    persist(optimistic)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          userContext: userContext || {},
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value)

        persist(
          optimistic.map((m) => (m.id === assistantMsg.id ? { ...m, content: full } : m))
        )
      }
    } catch (err) {
      const fallback = err instanceof Error ? err.message : 'Request failed'
      persist(
        optimistic.map((m) =>
          m.id === assistantMsg.id ? { ...m, content: `Sorry, I could not answer right now. (${fallback})` } : m
        )
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ width: 360, border: '1px solid #ddd', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
      <div style={{ padding: 12, borderBottom: '1px solid #eee', fontWeight: 600 }}>{title}</div>
      <div style={{ height: 420, overflowY: 'auto', padding: 12, background: '#fafafa' }}>
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              marginBottom: 10,
              display: 'flex',
              justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '80%',
                padding: '8px 10px',
                borderRadius: 10,
                background: m.role === 'user' ? '#2563eb' : '#fff',
                color: m.role === 'user' ? '#fff' : '#111',
                border: m.role === 'assistant' ? '1px solid #e5e7eb' : 'none',
                whiteSpace: 'pre-wrap',
              }}
            >
              {m.content}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid #eee' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSend()}
          placeholder="Type your message..."
          style={{ flex: 1, border: '1px solid #ddd', borderRadius: 8, padding: '8px 10px' }}
          disabled={loading}
        />
        <button
          onClick={onSend}
          disabled={loading}
          style={{ border: '1px solid #ddd', borderRadius: 8, padding: '8px 12px', background: '#fff', cursor: 'pointer' }}
        >
          {loading ? '...' : 'Send'}
        </button>
      </div>
    </div>
  )
}
