import crypto from "crypto"
import path from "path"

import type { LegalKnowledgeRecord } from "./pinecone"

export type SourceDocument = {
  fileName: string
  relativePath?: string
  sourceTitle: string
  category: string
  practiceArea: string
  sourceTier: string
  text: string
}

type LegalSegment = {
  text: string
  actName?: string
  chapterTitle?: string
  sectionRef?: string
}

const MIN_CHUNK_WORDS = 220
const TARGET_CHUNK_WORDS = 1000
const MAX_CHUNK_WORDS = 1200
const OVERLAP_WORDS = 150

const KNOWN_PPC_SECTION_TITLES = new Map<string, number | string>([
  ["punishment for theft", 379],
  ["theft in dwelling house, etc.", 380],
  ["theft by clerk or servant or property in possession of master", 381],
  ["theft of a car or other motor vehicles", "381-A"],
  ["theft after preparation made for causing death, hurt or restraint in order to the committing of the theft", 382],
  ["punishment for extortion", 384],
  ["putting person in fear of injury in order to commit extortion", 385],
  ["extortion by putting a person in fear of death or grievous hurt", 386],
  ["putting person in fear of death or of grievous hurt, in order to commit extortion", 387],
  ["extortion by threat of accusation of an offence punishable with death or imprisonment for life, etc.", 388],
  ["putting person in fear of accusation of offence, in order to commit extortion", 389],
  ["punishment for robbery", 392],
  ["attempt to commit robbery", 393],
  ["voluntarily causing hurt in committing robbery", 394],
  ["punishment for dacoity", 395],
  ["dacoity with murder", 396],
  ["robbery or dacoity, with attempt to cause death or grievous hurt", 397],
  ["attempt to commit robbery or dacoity when armed with deadly weapon", 398],
  ["making preparation to commit dacoity", 399],
  ["punishment for belonging to gang of dacoits", 400],
  ["punishment for belonging to gang of thieves", 401],
  ["assembling for purpose of committing dacoity", 402],
  ["dishonest misappropriation of property", 403],
  ["dishonest misappropriation of property possessed by deceased person at the time of his death", 404],
  ["criminal breach of trust", 405],
  ["punishment for criminal breach of trust", 406],
  ["criminal breach of trust by carrier, etc.", 407],
  ["criminal breach of trust by clerk or servant", 408],
  ["criminal breach of trust by public servant, or by banker, merchant or agent", 409],
  ["stolen property", 410],
  ["dishonestly receiving stolen property", 411],
  ["dishonestly receiving stolen property in the commission of a dacoity", 412],
  ["habitually dealing in stolen property", 413],
  ["assisting in concealment of stolen property", 414],
])

export function normalizeKnowledgeText(input: string) {
  return input
    .replace(/\u0000/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export function titleFromFileName(fileName: string) {
  const base = path.basename(fileName, path.extname(fileName))
  return base
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function slugifySource(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "source"
}

function hashText(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 12)
}

function wordCount(value: string) {
  return value.split(/\s+/).filter(Boolean).length
}

function isNoiseLine(line: string) {
  const trimmed = line.trim()
  return (
    /^#+\s*$/.test(trimmed) ||
    /^#+\s*\[?\]?\s*$/.test(trimmed) ||
    /^#+\s*\d+(?:\s+\d+)*\s*$/.test(trimmed) ||
    /^#+\s*[\[\]]\s*$/.test(trimmed)
  )
}

function cleanRepeatedPageNoise(text: string) {
  const lines = text.split("\n")
  const counts = new Map<string, number>()

  for (const line of lines) {
    const cleaned = line.trim()
    if (cleaned.length < 4 || cleaned.length > 120) continue
    if (/^\d+$/.test(cleaned)) continue
    counts.set(cleaned, (counts.get(cleaned) || 0) + 1)
  }

  const repeated = new Set(
    [...counts.entries()]
      .filter(([, count]) => count >= 4)
      .map(([line]) => line),
  )

  return lines
    .filter((line) => {
      const cleaned = line.trim()
      if (isNoiseLine(cleaned)) return false
      if (/^(page\s*)?\d+$/i.test(cleaned)) return false
      return !repeated.has(cleaned)
    })
    .join("\n")
}

function detectAct(line: string) {
  const trimmed = line.replace(/^#+\s*/, "").trim()
  if (/amended by|amendment|ordinance|reforms/i.test(trimmed)) return undefined
  if (/pakistan penal code/i.test(trimmed)) return "Pakistan Penal Code"

  const match = trimmed.match(/^(?:the\s+)?([a-z][a-z\s,'()/-]+ act,?\s+\d{4})$/i)
  if (!match) return undefined
  return trimmed.replace(/\s+/g, " ")
}

function detectChapter(line: string) {
  const trimmed = line.replace(/^#+\s*/, "").trim()
  if (/^chapter\s+([ivxlcdm]+|\d+)\b/i.test(trimmed)) {
    return trimmed.replace(/\s+/g, " ").slice(0, 180)
  }
  return undefined
}

function titleFromBullet(line: string) {
  const trimmed = line.trim()
  const match = trimmed.match(/^-\s+(.{3,220}):\s*$/)
  if (!match) return undefined
  return match[1].replace(/\s+/g, " ").trim()
}

function normalizeTitleKey(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s+,\s+/g, ", ")
    .trim()
}

function sectionNumberValue(sectionNumber: number | string) {
  return typeof sectionNumber === "number" ? sectionNumber : Number.parseInt(sectionNumber, 10)
}

function detectExplicitSection(line: string) {
  const trimmed = line.replace(/^#+\s*/, "").trim()
  const patterns = [
    /^(section\s+\d+[a-z]?(?:[-\s][a-z0-9]+)?)(?:[.:)-]|\s+-)?\s*(.*)$/i,
    /^(s\.\s*\d+[a-z]?(?:[-\s][a-z0-9]+)?)(?:[.:)-]|\s+-)?\s*(.*)$/i,
    /^(\d+[a-z]?)\.\s+([A-Z][^\n]{2,160})$/,
  ]

  for (const pattern of patterns) {
    const match = trimmed.match(pattern)
    if (match) {
      const prefix = match[1].replace(/\s+/g, " ").trim()
      const title = (match[2] || "").replace(/\s+/g, " ").trim()
      const sectionNumber = prefix.match(/\d+[a-z]?/i)?.[0]
      return {
        sectionNumber: sectionNumber ? Number.parseInt(sectionNumber, 10) : undefined,
        sectionRef: title ? `Section ${sectionNumber || prefix}: ${title}` : `Section ${sectionNumber || prefix}`,
      }
    }
  }

  return undefined
}

function splitLongSegment(segment: LegalSegment) {
  const words = segment.text.split(/\s+/).filter(Boolean)
  if (words.length <= MAX_CHUNK_WORDS) return [segment]

  const chunks: LegalSegment[] = []
  let start = 0

  while (start < words.length) {
    const end = Math.min(start + TARGET_CHUNK_WORDS, words.length)
    chunks.push({
      ...segment,
      text: words.slice(start, end).join(" "),
    })

    if (end === words.length) break
    start = Math.max(0, end - OVERLAP_WORDS)
  }

  return chunks
}

function splitByLegalStructure(text: string, fallbackActName?: string) {
  const cleaned = cleanRepeatedPageNoise(normalizeKnowledgeText(text))
  const lines = cleaned.split("\n")
  const segments: LegalSegment[] = []
  let actName: string | undefined = fallbackActName
  let chapterTitle: string | undefined
  let sectionRef: string | undefined
  let lastSectionNumber: number | undefined
  let buffer: string[] = []

  const flush = () => {
    const segmentText = normalizeKnowledgeText(buffer.join("\n"))
    buffer = []

    if (!segmentText || wordCount(segmentText) < 40) return
    segments.push({ text: segmentText, actName, chapterTitle, sectionRef })
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      buffer.push("")
      continue
    }

    const nextAct = detectAct(trimmed)
    const nextChapter = detectChapter(trimmed)
    const explicitSection = detectExplicitSection(trimmed)
    const bulletTitle = titleFromBullet(trimmed)
    const knownSectionNumber = bulletTitle
      ? KNOWN_PPC_SECTION_TITLES.get(normalizeTitleKey(bulletTitle))
      : undefined
    const inferredSection =
      !explicitSection && bulletTitle && knownSectionNumber
        ? {
            sectionNumber: sectionNumberValue(knownSectionNumber),
            sectionRef: `Section ${knownSectionNumber}: ${bulletTitle}`,
          }
        : !explicitSection && bulletTitle && lastSectionNumber
        ? {
            sectionNumber: lastSectionNumber + 1,
            sectionRef: `Section ${lastSectionNumber + 1}: ${bulletTitle}`,
          }
        : undefined
    const nextSection = explicitSection || inferredSection
    const startsNewSegment = Boolean(nextAct || nextChapter || nextSection)

    if (startsNewSegment && buffer.length > 0) {
      flush()
    }

    if (nextAct) actName = nextAct
    if (nextChapter) chapterTitle = nextChapter
    if (nextSection) {
      sectionRef = nextSection.sectionRef
      if (nextSection.sectionNumber) lastSectionNumber = nextSection.sectionNumber
    }

    buffer.push(nextSection && bulletTitle ? `## ${nextSection.sectionRef}` : trimmed)
  }

  flush()
  return segments.flatMap(splitLongSegment)
}

function fallbackChunks(text: string) {
  return splitLongSegment({ text: normalizeKnowledgeText(text) })
}

function mergeTinySegments(segments: LegalSegment[]) {
  const merged: LegalSegment[] = []

  for (const segment of segments) {
    const previous = merged[merged.length - 1]
    const bothAreLegalSections = Boolean(previous?.sectionRef && segment.sectionRef)
    if (
      previous &&
      !bothAreLegalSections &&
      wordCount(segment.text) < MIN_CHUNK_WORDS &&
      wordCount(previous.text) < TARGET_CHUNK_WORDS
    ) {
      previous.text = normalizeKnowledgeText(`${previous.text}\n\n${segment.text}`)
      previous.sectionRef = previous.sectionRef || segment.sectionRef
      previous.chapterTitle = previous.chapterTitle || segment.chapterTitle
      previous.actName = previous.actName || segment.actName
      continue
    }

    merged.push({ ...segment })
  }

  return merged
}

export function chunkLegalDocument(document: SourceDocument): LegalKnowledgeRecord[] {
  const normalized = normalizeKnowledgeText(document.text)
  const structured = splitByLegalStructure(normalized, document.sourceTitle)
  const segments = mergeTinySegments(structured.length ? structured : fallbackChunks(normalized))
  const sourceSlug = slugifySource(document.sourceTitle || document.fileName)

  return segments.map((segment, index) => {
    const chunkText = normalizeKnowledgeText(segment.text)

    return {
      id: `${slugifySource(document.category)}:${sourceSlug}:${index}:${hashText(chunkText)}`,
      chunk_text: chunkText,
      jurisdiction: "Pakistan",
      category: document.category,
      practice_area: document.practiceArea,
      source_tier: document.sourceTier,
      source_type: "book",
      source_title: document.sourceTitle,
      source_file: document.fileName,
      ...(document.relativePath ? { source_path: document.relativePath } : {}),
      act_name: segment.actName || document.sourceTitle,
      ...(segment.sectionRef ? { section_ref: segment.sectionRef } : {}),
      ...(segment.chapterTitle ? { chapter_title: segment.chapterTitle } : {}),
      chunk_index: index,
    }
  })
}
