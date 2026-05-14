import type { RetrievedContext } from './types'

export function formatContextForPrompt(contexts: RetrievedContext[]): string {
  if (!contexts.length) return ''

  const grouped = contexts.reduce<Record<string, string[]>>((acc, item) => {
    const key = item.collection || 'knowledge'
    if (!acc[key]) acc[key] = []
    acc[key].push(item.text)
    return acc
  }, {})

  return `## Retrieved Context\n${Object.entries(grouped)
    .map(([collection, texts]) => `### ${collection}\n${texts.map((t) => `- ${t}`).join('\n')}`)
    .join('\n\n')}`
}
