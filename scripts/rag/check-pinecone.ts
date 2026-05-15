import { loadEnvConfig } from "@next/env"

import { getLegalRagConfig } from "@/lib/rag/config"
import { ensureLegalRagIndex, searchLegalKnowledge } from "@/lib/rag/pinecone"

loadEnvConfig(process.cwd())

async function main() {
  const config = getLegalRagConfig()
  const query = process.argv.slice(2).join(" ").trim() || "murder under Pakistani criminal law"

  if (!config.pineconeApiKey) {
    throw new Error("PINECONE_API_KEY is required for Pinecone checks")
  }

  console.log(`Checking Pinecone index: ${config.indexName}`)
  console.log(`Namespace: ${config.namespace}`)
  console.log(`Query: ${query}`)

  await ensureLegalRagIndex(config)
  const hits = await searchLegalKnowledge(query, { topK: 5, config })

  console.log(`Hits: ${hits.length}`)
  for (const hit of hits) {
    const title = [hit.source_title, hit.act_name, hit.section_ref].filter(Boolean).join(" | ")
    const preview = hit.chunk_text.replace(/\s+/g, " ").slice(0, 240)
    console.log("")
    console.log(`${hit.id} score=${hit.score.toFixed(4)}`)
    console.log(title)
    console.log(preview)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
