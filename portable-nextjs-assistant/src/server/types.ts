export type AssistantRole = 'user' | 'assistant' | 'system'

export type AssistantInputMessage = {
  role: AssistantRole
  content: string
}

export type AssistantUserContext = {
  isAuthenticated?: boolean
  userType?: string | null
  [key: string]: unknown
}

export type RetrievedContext = {
  id: string
  text: string
  score: number
  collection?: string
}

export type RetrieveContextFn = (query: string, topK: number) => Promise<RetrievedContext[]>

export type RouteLabelMap = Record<string, string>
