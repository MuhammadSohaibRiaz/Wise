/**
 * Heuristic checks on extracted document text before sending to the LLM.
 * Does not replace prompt guardrails; complements them for logging / alerting.
 */

export type InjectionSeverity = "info" | "low" | "medium" | "high"

export interface InjectionHit {
  detected_attack_type: string
  severity: InjectionSeverity
  raw_excerpt: string
}

const PATTERNS: Array<{ type: string; severity: InjectionSeverity; re: RegExp }> = [
  { type: "instruction_override", severity: "high", re: /ignore\s+(previous|all|prior)\s+instructions/i },
  { type: "instruction_override", severity: "high", re: /disregard\s+(the\s+)?(above|prior)/i },
  { type: "system_prompt_extract", severity: "high", re: /reveal\s+(your\s+)?(system\s+)?prompt/i },
  { type: "system_prompt_extract", severity: "medium", re: /show\s+(me\s+)?(the\s+)?hidden\s+instructions/i },
  { type: "role_play_attack", severity: "medium", re: /\byou\s+are\s+now\s+(an?\s+)?admin/i },
  { type: "role_play_attack", severity: "medium", re: /act\s+as\s+(the\s+)?super\s?user/i },
  { type: "config_extract", severity: "medium", re: /return\s+(your\s+)?(api\s+|secret\s+|env\s+)/i },
]

export function scanDocumentTextForInjection(text: string, maxHits = 8): InjectionHit[] {
  if (!text || text.length === 0) return []
  const slice = text.length > 120_000 ? text.slice(0, 120_000) : text
  const hits: InjectionHit[] = []
  for (const { type, severity, re } of PATTERNS) {
    const m = slice.match(re)
    if (m && m[0]) {
      hits.push({
        detected_attack_type: type,
        severity,
        raw_excerpt: m[0].slice(0, 500),
      })
      if (hits.length >= maxHits) break
    }
  }
  return hits
}
