import type { AssistantUserContext, RouteLabelMap } from './types'

export const DEFAULT_ROUTE_LABELS: RouteLabelMap = {
  '/': 'Home',
  '/login': 'Log In',
  '/signup': 'Sign Up',
  '/dashboard': 'Dashboard',
}

export function defaultSystemPrompt(ctx: AssistantUserContext): string {
  const identity = ctx?.isAuthenticated ? 'authenticated user' : 'guest user'
  return [
    'You are a helpful website assistant.',
    `Current user type: ${ctx?.userType || 'unknown'} (${identity}).`,
    'Answer clearly and briefly.',
    'If the user asks about unavailable data, say so honestly.',
    'Do not provide legal, medical, or financial advice.',
  ].join(' ')
}

export function defaultFastReply(text: string): string | null {
  const t = text.toLowerCase().trim()
  if (/^(hi|hello|hey|salam|assalam o alaikum)[.!?]*$/.test(t)) {
    return 'Hello! How can I help you today?'
  }
  if (/^(thanks|thank you|thx)[.!?]*$/.test(t)) {
    return 'You are welcome. Need help with anything else?'
  }
  return null
}
