export function extractCaseIdFromPath(input?: string | null): string | null {
  if (!input) return null

  const fromQuery = input.match(/[?&]case=([0-9a-fA-F-]{36})/)
  if (fromQuery?.[1]) return fromQuery[1]

  const fromCasePage = input.match(/\/(?:client|lawyer)\/cases\/([0-9a-fA-F-]{36})(?:\/|$|\?)/)
  if (fromCasePage?.[1]) return fromCasePage[1]

  return null
}
