import { streamText } from 'ai'
import { createGroq } from '@ai-sdk/groq'
import { NextResponse } from 'next/server'
import { formatContextForPrompt } from './formatContext'
import type { AssistantInputMessage, AssistantUserContext, RetrieveContextFn } from './types'

type CreateAssistantRouteOptions = {
  getSystemPrompt: (ctx: AssistantUserContext) => string
  retrieveContext?: RetrieveContextFn
  model?: string
  temperature?: number
  topK?: number
  fastReply?: (latestUserText: string, ctx: AssistantUserContext) => string | null
  emergencyReply?: (latestUserText: string, ctx: AssistantUserContext) => string | null
}

function normalizeMessages(raw: unknown): AssistantInputMessage[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((m) => {
      const role = (m as any)?.role
      const content = ((m as any)?.content || (m as any)?.text || '').toString()
      return { role, content }
    })
    .filter((m): m is AssistantInputMessage => {
      return (m.role === 'user' || m.role === 'assistant' || m.role === 'system') && m.content.trim().length > 0
    })
}

export function createAssistantRoute(options: CreateAssistantRouteOptions) {
  return async function POST(req: Request) {
    try {
      const body = await req.json()
      const messages = normalizeMessages(body?.messages)
      const userContext = (body?.userContext || {}) as AssistantUserContext

      if (messages.length === 0) {
        return NextResponse.json({ error: 'No valid messages provided' }, { status: 400 })
      }

      const latestUser = [...messages].reverse().find((m) => m.role === 'user')
      const query = latestUser?.content || ''

      if (options.emergencyReply) {
        const emergency = options.emergencyReply(query, userContext)
        if (emergency) return new Response(emergency, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
      }

      if (options.fastReply) {
        const quick = options.fastReply(query, userContext)
        if (quick) return new Response(quick, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
      }

      const systemBase = options.getSystemPrompt(userContext)

      let system = systemBase
      if (options.retrieveContext && query.trim()) {
        const contexts = await options.retrieveContext(query, options.topK ?? 7)
        const contextBlock = formatContextForPrompt(contexts)
        if (contextBlock) system = `${systemBase}\n\n${contextBlock}`
      }

      const apiKey = process.env.GROQ_API_KEY
      if (!apiKey) {
        return NextResponse.json({ error: 'GROQ_API_KEY is missing' }, { status: 500 })
      }

      const groq = createGroq({ apiKey })
      const modelName = options.model || process.env.ASSISTANT_MODEL || 'llama-3.3-70b-versatile'
      const temperature = Number.isFinite(options.temperature) ? options.temperature : Number(process.env.ASSISTANT_TEMPERATURE || 0.3)

      const stream = await streamText({
        model: groq(modelName),
        system,
        messages,
        temperature,
      })

      return stream.toTextStreamResponse()
    } catch (error) {
      console.error('[PortableAssistant] Route error:', error)
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 })
    }
  }
}
