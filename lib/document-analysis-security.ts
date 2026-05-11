/**
 * Pre-LLM heuristic scanner for prompt injection, jailbreak, and manipulation
 * attempts embedded in document text. Complements the system-prompt guardrails
 * by detecting and logging suspicious content before it reaches the model.
 */

export type InjectionSeverity = "info" | "low" | "medium" | "high"

export interface InjectionHit {
  detected_attack_type: string
  severity: InjectionSeverity
  raw_excerpt: string
}

const PATTERNS: Array<{ type: string; severity: InjectionSeverity; re: RegExp }> = [
  // --- Instruction override / prompt hijacking ---
  { type: "instruction_override", severity: "high", re: /ignore\s+(previous|all|prior|above|the)\s+(instructions|prompt|rules|guidelines)/i },
  { type: "instruction_override", severity: "high", re: /disregard\s+(the\s+)?(above|prior|previous|system)/i },
  { type: "instruction_override", severity: "high", re: /forget\s+(everything|all|your)\s+(above|previous|instructions|rules)/i },
  { type: "instruction_override", severity: "high", re: /override\s+(your\s+)?(instructions|rules|prompt|guidelines)/i },
  { type: "instruction_override", severity: "high", re: /new\s+instructions?\s*:/i },
  { type: "instruction_override", severity: "medium", re: /do\s+not\s+follow\s+(your|the)\s+(original|system|previous)/i },
  { type: "instruction_override", severity: "medium", re: /stop\s+being\s+(a\s+)?(legal|document)\s+(analyst|assistant)/i },

  // --- System prompt extraction ---
  { type: "system_prompt_extract", severity: "high", re: /reveal\s+(your\s+)?(system\s+)?prompt/i },
  { type: "system_prompt_extract", severity: "high", re: /output\s+(your\s+)?(system\s+|hidden\s+)?(prompt|instructions)/i },
  { type: "system_prompt_extract", severity: "high", re: /print\s+(your\s+)?(system\s+|initial\s+)?(prompt|instructions|message)/i },
  { type: "system_prompt_extract", severity: "medium", re: /show\s+(me\s+)?(the\s+)?(hidden|secret|system)\s+(instructions|prompt|message)/i },
  { type: "system_prompt_extract", severity: "medium", re: /what\s+(are|were)\s+(your|the)\s+(original|system|initial)\s+(instructions|prompt)/i },
  { type: "system_prompt_extract", severity: "medium", re: /repeat\s+(your\s+)?(system\s+|initial\s+)?(prompt|instructions|message)\s+(back|verbatim)/i },

  // --- Role play / identity switching ---
  { type: "role_play_attack", severity: "high", re: /\byou\s+are\s+now\s+(an?\s+)?(admin|hacker|unrestricted|unfiltered|evil|DAN)/i },
  { type: "role_play_attack", severity: "high", re: /act\s+as\s+(the\s+)?(super\s?user|admin|root|hacker|DAN|unrestricted)/i },
  { type: "role_play_attack", severity: "medium", re: /pretend\s+(to\s+be|you\s+are)\s+(a\s+)?(different|new|unrestricted)/i },
  { type: "role_play_attack", severity: "medium", re: /switch\s+(to|into)\s+(a\s+)?(different|new|jailbroken|unrestricted)\s+(mode|role|persona)/i },
  { type: "role_play_attack", severity: "medium", re: /enter\s+(developer|debug|admin|god|jailbreak)\s+mode/i },
  { type: "role_play_attack", severity: "medium", re: /\bDAN\b.*\bjailbreak/i },
  { type: "role_play_attack", severity: "low", re: /respond\s+without\s+(any\s+)?(restrictions|filters|limitations|guardrails)/i },

  // --- Config / secret extraction ---
  { type: "config_extract", severity: "high", re: /return\s+(your\s+)?(api\s+key|secret|env|token|password|credential)/i },
  { type: "config_extract", severity: "medium", re: /what\s+is\s+(your\s+)?(api\s+key|password|secret|token)/i },
  { type: "config_extract", severity: "medium", re: /give\s+(me\s+)?(your\s+)?(api|secret|env|token|key|credential)/i },

  // --- Fake urgency injection ---
  { type: "fake_urgency", severity: "medium", re: /\b(URGENT|EMERGENCY|CRITICAL)\s*:\s*(set|change|mark|assign|make)\s+(risk|urgency|seriousness)/i },
  { type: "fake_urgency", severity: "medium", re: /(set|change|mark)\s+(risk_level|urgency|seriousness)\s*(to|=|:)\s*["']?(High|Immediate|Critical)/i },
  { type: "fake_urgency", severity: "low", re: /always\s+(return|set|output|mark)\s+(risk|urgency|seriousness)\s+(as\s+)?(high|immediate|critical)/i },

  // --- Lawyer / result manipulation ---
  { type: "result_manipulation", severity: "high", re: /(always|must)\s+(recommend|return|output|set)\s+["']?is_legal_document["']?\s*(to|=|:)\s*true/i },
  { type: "result_manipulation", severity: "medium", re: /(mark|classify|set)\s+(this|the\s+document)\s+as\s+(legal|high\s+risk|urgent|critical)/i },
  { type: "result_manipulation", severity: "medium", re: /manipulate\s+(the\s+)?(result|output|analysis|score|risk)/i },

  // --- SQL / code injection text ---
  { type: "code_injection_text", severity: "low", re: /;\s*(DROP|DELETE|UPDATE|INSERT|ALTER|EXEC)\s/i },
  { type: "code_injection_text", severity: "low", re: /\b(eval|exec|system|os\.popen|subprocess)\s*\(/i },
  { type: "code_injection_text", severity: "info", re: /<script[\s>]/i },

  // --- Prompt stuffing (same phrase repeated) ---
  { type: "prompt_stuffing", severity: "medium", re: /(ignore\s+(all|previous|prior)\s+instructions\s*[.!]?\s*){3,}/i },
  { type: "prompt_stuffing", severity: "medium", re: /(you\s+are\s+now\s+\w+\s*[.!]?\s*){3,}/i },
]

export function scanDocumentTextForInjection(text: string, maxHits = 12): InjectionHit[] {
  if (!text || text.length === 0) return []
  const slice = text.length > 120_000 ? text.slice(0, 120_000) : text
  const hits: InjectionHit[] = []
  const seenTypes = new Set<string>()

  for (const { type, severity, re } of PATTERNS) {
    const m = slice.match(re)
    if (m && m[0]) {
      if (seenTypes.has(type) && severity !== "high") continue
      seenTypes.add(type)
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

export function hasHighSeverityInjection(hits: InjectionHit[]): boolean {
  return hits.some((h) => h.severity === "high")
}
