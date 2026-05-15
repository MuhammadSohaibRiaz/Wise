import fs from "fs/promises"
import path from "path"

import { loadEnvConfig } from "@next/env"

import { getLegalRagConfig } from "@/lib/rag/config"
import { chunkLegalDocument, normalizeKnowledgeText, titleFromFileName } from "@/lib/rag/knowledge-processing"
import {
  deleteLegalRagNamespaceRecords,
  ensureLegalRagIndex,
  getLegalRagNamespace,
  recreateLegalRagIndex,
  type LegalKnowledgeRecord,
} from "@/lib/rag/pinecone"

loadEnvConfig(process.cwd())

const SOURCE_ROOT = path.join(process.cwd(), "data", "legal-knowledge")
const SUPPORTED_EXTENSIONS = new Set([".pdf", ".txt", ".md"])
const BATCH_SIZE = 8
const TOKEN_BUDGET_PER_MINUTE = 180_000

const CORPORA: Record<string, { category: string; practiceArea: string; sourceTier: string }> = {
  criminal: { category: "criminal", practiceArea: "Criminal law and evidence", sourceTier: "primary_code" },
  family: { category: "family", practiceArea: "Family law", sourceTier: "primary_code" },
  tax: { category: "tax", practiceArea: "Tax law", sourceTier: "primary_code" },
  labour: { category: "labour", practiceArea: "Labour and employment law", sourceTier: "primary_code" },
  immigration: { category: "immigration", practiceArea: "Immigration and overseas employment", sourceTier: "primary_code" },
  civil: { category: "civil", practiceArea: "Contract and civil disputes", sourceTier: "primary_code" },
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function estimateEmbeddingTokens(records: LegalKnowledgeRecord[]) {
  return records.reduce((total, record) => {
    const words = record.chunk_text.split(/\s+/).filter(Boolean).length
    const byWords = Math.ceil(words * 1.5)
    const byChars = Math.ceil(record.chunk_text.length / 2)
    return total + Math.max(byWords, byChars)
  }, 0)
}

function isRateLimitError(error: any) {
  const message = String(error?.message || error)
  const status = error?.status || error?.response?.status
  return status === 429 || message.includes("RESOURCE_EXHAUSTED") || message.includes("max tokens per minute")
}

async function readPdf(filePath: string) {
  const pdfModule = await import("pdf-parse-fork")
  const pdfParse = (pdfModule as any).default || pdfModule
  const buffer = await fs.readFile(filePath)
  const parsed = await (pdfParse as any)(buffer)
  return String(parsed?.text || "")
}

async function extractText(filePath: string) {
  const ext = path.extname(filePath).toLowerCase()

  if (ext === ".pdf") {
    return readPdf(filePath)
  }

  return fs.readFile(filePath, "utf8")
}

type SourceFile = {
  filePath: string
  relativePath: string
  corpus: (typeof CORPORA)[string]
}

async function listSourceFiles() {
  await fs.mkdir(SOURCE_ROOT, { recursive: true })
  const files: SourceFile[] = []

  for (const [folder, corpus] of Object.entries(CORPORA)) {
    const folderPath = path.join(SOURCE_ROOT, folder)
    await fs.mkdir(folderPath, { recursive: true })
    await collectFiles(folderPath, folderPath, corpus, files)
  }

  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath))
}

async function collectFiles(root: string, current: string, corpus: SourceFile["corpus"], files: SourceFile[]) {
  const entries = await fs.readdir(current, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.name.startsWith("_")) continue

    const filePath = path.join(current, entry.name)

    if (entry.isDirectory()) {
      await collectFiles(root, filePath, corpus, files)
      continue
    }

    if (!entry.isFile()) continue
    if (entry.name.toLowerCase() === "readme.md") continue
    if (!SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue

    files.push({
      filePath,
      relativePath: path.relative(SOURCE_ROOT, filePath).replace(/\\/g, "/"),
      corpus,
    })
  }
}

async function upsertInBatches(records: LegalKnowledgeRecord[]) {
  const namespace = await getLegalRagNamespace()
  let upserted = 0
  let minuteWindowStartedAt = Date.now()
  let estimatedTokensThisMinute = 0

  for (let index = 0; index < records.length; index += BATCH_SIZE) {
    const batch = records.slice(index, index + BATCH_SIZE)
    const batchTokens = estimateEmbeddingTokens(batch)
    const now = Date.now()
    const elapsed = now - minuteWindowStartedAt

    if (elapsed >= 60_000) {
      minuteWindowStartedAt = now
      estimatedTokensThisMinute = 0
    }

    if (estimatedTokensThisMinute + batchTokens > TOKEN_BUDGET_PER_MINUTE) {
      const waitMs = Math.max(1_000, 61_000 - elapsed)
      console.log(`Waiting ${Math.ceil(waitMs / 1000)}s for Pinecone embedding rate limit window`)
      await sleep(waitMs)
      minuteWindowStartedAt = Date.now()
      estimatedTokensThisMinute = 0
    }

    try {
      await namespace.upsertRecords({ records: batch } as any)
    } catch (error) {
      if (!isRateLimitError(error)) {
        throw error
      }

      console.log("Pinecone rate limit reached. Waiting 65s before retrying this batch")
      await sleep(65_000)
      minuteWindowStartedAt = Date.now()
      estimatedTokensThisMinute = 0
      await namespace.upsertRecords({ records: batch } as any)
    }

    estimatedTokensThisMinute += batchTokens
    upserted += batch.length
    console.log(`Upserted ${upserted}/${records.length} records`)
  }

  return upserted
}

async function main() {
  const config = getLegalRagConfig()
  const reset = process.argv.includes("--reset") || process.env.RAG_RESET === "1"
  const recreateIndex = process.argv.includes("--recreate-index") || process.env.RAG_RECREATE_INDEX === "1"

  if (!config.pineconeApiKey) {
    throw new Error("PINECONE_API_KEY is required for ingestion")
  }

  console.log(`Source root: ${SOURCE_ROOT}`)
  console.log(`Pinecone index: ${config.indexName}`)
  console.log(`Namespace: ${config.namespace}`)
  console.log(`Embedding model: ${config.embedModel}`)
  console.log(`Mode: ${recreateIndex ? "recreate index, then ingest" : reset ? "reset namespace, then ingest" : "upsert only"}`)

  if (recreateIndex) {
    console.log(`Recreating Pinecone index: ${config.indexName}`)
    await recreateLegalRagIndex(config)
  } else {
    await ensureLegalRagIndex(config)
  }

  if (reset && !recreateIndex) {
    console.log(`Resetting Pinecone namespace: ${config.namespace}`)
    await deleteLegalRagNamespaceRecords(config)
  }

  const files = await listSourceFiles()
  const allRecords: LegalKnowledgeRecord[] = []
  const failedFiles: Array<{ file: string; error: string }> = []
  let extractedCharacters = 0

  for (const sourceFile of files) {
    const fileName = path.basename(sourceFile.filePath)

    try {
      const rawText = await extractText(sourceFile.filePath)
      const text = normalizeKnowledgeText(rawText)
      extractedCharacters += text.length

      if (!text) {
        console.warn(`Skipped empty file: ${fileName}`)
        continue
      }

      const records = chunkLegalDocument({
        fileName,
        relativePath: sourceFile.relativePath,
        sourceTitle: titleFromFileName(fileName),
        category: sourceFile.corpus.category,
        practiceArea: sourceFile.corpus.practiceArea,
        sourceTier: sourceFile.corpus.sourceTier,
        text,
      })

      allRecords.push(...records)
      console.log(`${sourceFile.relativePath}: ${text.length} chars, ${records.length} chunks`)
    } catch (error: any) {
      failedFiles.push({ file: fileName, error: error?.message || String(error) })
      console.error(`Failed ${fileName}: ${error?.message || error}`)
    }
  }

  const upserted = allRecords.length ? await upsertInBatches(allRecords) : 0

  console.log("")
  console.log("RAG ingestion complete")
  console.log(`Files found: ${files.length}`)
  console.log(`Files failed: ${failedFiles.length}`)
  console.log(`Extracted characters: ${extractedCharacters}`)
  console.log(`Chunks generated: ${allRecords.length}`)
  console.log(`Records upserted: ${upserted}`)

  if (failedFiles.length) {
    console.log("Failed files:")
    for (const failed of failedFiles) {
      console.log(`- ${failed.file}: ${failed.error}`)
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
