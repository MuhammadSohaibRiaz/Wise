import { Pinecone } from "@pinecone-database/pinecone"
import { getLegalRagConfig, type LegalRagConfig } from "./config"

export type LegalKnowledgeRecord = {
  id: string
  chunk_text: string
  jurisdiction: "Pakistan"
  category: string
  practice_area: string
  source_tier: string
  source_type: "book"
  source_title: string
  source_file: string
  source_path?: string
  act_name?: string
  section_ref?: string
  chapter_title?: string
  chunk_index: number
}

export type LegalKnowledgeHit = LegalKnowledgeRecord & {
  score: number
}

export function createPineconeClient(config = getLegalRagConfig()) {
  if (!config.pineconeApiKey) {
    throw new Error("PINECONE_API_KEY is not configured")
  }

  return new Pinecone({ apiKey: config.pineconeApiKey })
}

export async function ensureLegalRagIndex(config = getLegalRagConfig()) {
  const pinecone = createPineconeClient(config)

  try {
    return await pinecone.describeIndex(config.indexName)
  } catch (error: any) {
    const message = String(error?.message || error)
    const name = String(error?.name || "")
    const status = error?.status || error?.response?.status
    const missing =
      status === 404 ||
      name.toLowerCase().includes("notfound") ||
      message.toLowerCase().includes("not found") ||
      message.includes("HTTP status 404")

    if (!missing) {
      throw error
    }
  }

  await pinecone.createIndexForModel({
    name: config.indexName,
    cloud: config.cloud,
    region: config.region,
    embed: {
      model: config.embedModel,
      fieldMap: { text: "chunk_text" },
    },
    waitUntilReady: true,
  })

  return pinecone.describeIndex(config.indexName)
}

export async function getLegalRagNamespace(config = getLegalRagConfig()) {
  const pinecone = createPineconeClient(config)
  const indexModel = await pinecone.describeIndex(config.indexName)
  const host = indexModel.host

  if (host) {
    return pinecone.index({ host, namespace: config.namespace })
  }

  return pinecone.index(config.indexName).namespace(config.namespace)
}

export async function deleteLegalRagNamespaceRecords(config = getLegalRagConfig()) {
  const pinecone = createPineconeClient(config)
  const indexModel = await pinecone.describeIndex(config.indexName)
  const host = indexModel.host
  const index = host ? pinecone.index({ host }) : pinecone.index(config.indexName)

  await index.deleteAll({ namespace: config.namespace })
  await waitForNamespaceRecordCount(index, config.namespace, 0)
}

export async function recreateLegalRagIndex(config = getLegalRagConfig()) {
  const pinecone = createPineconeClient(config)

  try {
    await pinecone.deleteIndex(config.indexName)
  } catch (error: any) {
    const message = String(error?.message || error).toLowerCase()
    const name = String(error?.name || "").toLowerCase()
    const status = error?.status || error?.response?.status

    if (status !== 404 && !name.includes("notfound") && !message.includes("not found")) {
      throw error
    }
  }

  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      await pinecone.describeIndex(config.indexName)
      await new Promise((resolve) => setTimeout(resolve, 2_000))
    } catch {
      break
    }
  }

  return ensureLegalRagIndex(config)
}

async function waitForNamespaceRecordCount(index: any, namespace: string, expectedCount: number) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const stats = await index.describeIndexStats()
    const count = Number(stats?.namespaces?.[namespace]?.recordCount || 0)

    if (count === expectedCount) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 2_000))
  }
}

function stringField(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function numberField(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
    return Number(value)
  }
  return undefined
}

export async function searchLegalKnowledge(query: string, options?: { topK?: number; config?: LegalRagConfig }) {
  const config = options?.config || getLegalRagConfig()
  const namespace = await getLegalRagNamespace(config)
  const expandedQuery = expandPakistaniLegalQuery(query)
  const finalTopK = options?.topK || config.topK

  const response = await namespace.searchRecords({
    query: {
      topK: Math.min(Math.max(finalTopK * 4, 12), 40),
      inputs: { text: expandedQuery },
      filter: { jurisdiction: { $eq: "Pakistan" } },
    },
    fields: [
      "chunk_text",
      "jurisdiction",
      "category",
      "practice_area",
      "source_tier",
      "source_type",
      "source_title",
      "source_file",
      "source_path",
      "act_name",
      "section_ref",
      "chapter_title",
      "chunk_index",
    ],
  } as any)

  const hits = ((response as any)?.result?.hits || []) as Array<{
    _id?: string
    _score?: number
    fields?: Record<string, unknown>
  }>

  const parsedHits = hits
    .map((hit) => {
      const fields = hit.fields || {}
      const chunkText = stringField(fields.chunk_text)
      const sourceTitle = stringField(fields.source_title)
      const sourceFile = stringField(fields.source_file)

      if (!hit._id || !chunkText || !sourceTitle || !sourceFile) {
        return null
      }

      return {
        id: hit._id,
        score: Number(hit._score || 0),
        chunk_text: chunkText,
        jurisdiction: "Pakistan" as const,
        category: stringField(fields.category) || "unknown",
        practice_area: stringField(fields.practice_area) || stringField(fields.category) || "unknown",
        source_tier: stringField(fields.source_tier) || "primary_code",
        source_type: "book" as const,
        source_title: sourceTitle,
        source_file: sourceFile,
        source_path: stringField(fields.source_path),
        act_name: stringField(fields.act_name),
        section_ref: stringField(fields.section_ref),
        chapter_title: stringField(fields.chapter_title),
        chunk_index: numberField(fields.chunk_index) || 0,
      }
    })
    .filter(Boolean) as LegalKnowledgeHit[]

  return rerankLegalHits(query, parsedHits).slice(0, finalTopK)
}

function expandPakistaniLegalQuery(query: string) {
  const normalized = query.toLowerCase()
  const expansions: string[] = []

  if (/\bmurder\b|\bhomicide\b|\bqatl\b/.test(normalized)) {
    expansions.push("qatl-e-amd qatl-i-amd Section 300 Section 302 punishment death qisas ta'zir Pakistan Penal Code")
  }

  if (/\btheft\b|\bsteal\b|\bstolen\b/.test(normalized)) {
    expansions.push("theft Section 378 Section 379 Section 380 Section 381 Section 382 dishonestly movable property Pakistan Penal Code")
  }

  if (/\brobbery\b|\bdacoity\b/.test(normalized)) {
    expansions.push("robbery dacoity Section 390 Section 391 Section 392 Section 395 Pakistan Penal Code")
  }

  if (/\bkidnap|\babduct/.test(normalized)) {
    expansions.push("kidnapping abduction Section 359 Section 362 Pakistan Penal Code")
  }

  if (/\bfamily\b|\bmarriage\b|\bdivorce\b|\bdissolution\b|\bmaintenance\b|\bguardian|\bcustody\b|\bward\b/.test(normalized)) {
    expansions.push("family law marriage divorce dissolution maintenance guardians wards custody Pakistan")
  }

  if (/\btax\b|\bincome tax\b|\bsales tax\b|\bfbr\b|\breturn\b|\bassessment\b|\bwithholding\b/.test(normalized)) {
    expansions.push("Income Tax Ordinance Sales Tax Act FBR assessment return withholding Pakistan")
  }

  if (/\blabour\b|\blabor\b|\bemployment\b|\bindustrial relation|\btrade union\b|\bworker\b|\bemployer\b/.test(normalized)) {
    expansions.push("Industrial Relations Act labour employment worker employer trade union Pakistan")
  }

  if (/\bemigration\b|\boverseas\b|\bimmigration\b|\bprotector\b|\bforeign employment\b/.test(normalized)) {
    expansions.push("Emigration Rules overseas employment protector emigrant Pakistan")
  }

  if (/\bcontract\b|\bagreement\b|\bcivil dispute\b|\bbreach\b|\bconsideration\b|\bproposal\b|\bacceptance\b/.test(normalized)) {
    expansions.push("Contract Act agreement proposal acceptance consideration breach civil dispute Pakistan")
  }

  if (!expansions.length) return query
  return `${query}\n\nRelevant Pakistani legal terms: ${expansions.join("; ")}`
}

function rerankLegalHits(query: string, hits: LegalKnowledgeHit[]) {
  const normalized = query.toLowerCase()

  return [...hits].sort((left, right) => {
    return boostedScore(right, normalized) - boostedScore(left, normalized)
  })
}

function boostedScore(hit: LegalKnowledgeHit, query: string) {
  const searchable = `${hit.section_ref || ""} ${hit.act_name || ""} ${hit.chunk_text}`.toLowerCase()
  let score = hit.score

  const sectionNumbers = [...query.matchAll(/\bsection\s+(\d+[a-z]?)\b/g)].map((match) => match[1])
  for (const sectionNumber of sectionNumbers) {
    if ((hit.section_ref || "").toLowerCase().includes(`section ${sectionNumber}`)) score += 0.25
  }

  const keywordBoosts: Array<[RegExp, string[]]> = [
    [/\bmurder\b|\bhomicide\b|\bqatl\b/, ["section 300", "section 302", "qatl-i-amd", "qatl-e-amd"]],
    [/\btheft\b|\bsteal\b|\bstolen\b/, ["section 378", "section 379", "section 380", "section 381", "section 382", "theft"]],
    [/\brobbery\b|\bdacoity\b/, ["section 390", "section 391", "section 392", "section 395", "robbery", "dacoity"]],
    [/\bkidnap|\babduct/, ["section 359", "section 362", "kidnapping", "abduction"]],
    [/\bfamily\b|\bmarriage\b|\bdivorce\b|\bdissolution\b|\bmaintenance\b|\bguardian|\bcustody\b|\bward\b/, ["family", "marriage", "divorce", "dissolution", "maintenance", "guardian", "custody", "ward"]],
    [/\btax\b|\bincome tax\b|\bsales tax\b|\bfbr\b|\breturn\b|\bassessment\b|\bwithholding\b/, ["income tax", "sales tax", "fbr", "assessment", "return", "withholding"]],
    [/\blabour\b|\blabor\b|\bemployment\b|\bindustrial relation|\btrade union\b|\bworker\b|\bemployer\b/, ["industrial relations", "labour", "employment", "worker", "employer", "trade union"]],
    [/\bemigration\b|\boverseas\b|\bimmigration\b|\bprotector\b|\bforeign employment\b/, ["emigration", "overseas", "protector", "foreign employment"]],
    [/\bcontract\b|\bagreement\b|\bcivil dispute\b|\bbreach\b|\bconsideration\b|\bproposal\b|\bacceptance\b/, ["contract", "agreement", "proposal", "acceptance", "consideration", "breach"]],
  ]

  for (const [pattern, terms] of keywordBoosts) {
    if (!pattern.test(query)) continue
    for (const term of terms) {
      if ((hit.section_ref || "").toLowerCase().includes(term)) score += 0.2
      else if (searchable.includes(term)) score += 0.08
    }
  }

  return score
}

export function formatLegalContext(hits: LegalKnowledgeHit[]) {
  return hits
    .map((hit, index) => {
      const citationParts = [
        hit.source_title,
        hit.act_name,
        hit.chapter_title,
        hit.section_ref,
        `chunk ${hit.id}`,
      ].filter(Boolean)

      return [
        `[${index + 1}] ${citationParts.join(" | ")}`,
        hit.chunk_text,
      ].join("\n")
    })
    .join("\n\n---\n\n")
}
