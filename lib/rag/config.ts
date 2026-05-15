export type LegalRagConfig = {
  pineconeApiKey: string
  indexName: string
  namespace: string
  cloud: "aws" | "gcp" | "azure"
  region: string
  embedModel: string
  assistantModel: string
  assistantTemperature: number
  assistantMaxOutputTokens: number
  topK: number
}

export function getLegalRagConfig(): LegalRagConfig {
  return {
    pineconeApiKey: process.env.PINECONE_API_KEY || "",
    indexName: process.env.PINECONE_INDEX || "wisecase-legal-rag",
    namespace: process.env.PINECONE_NAMESPACE || "criminal-law",
    cloud: (process.env.PINECONE_CLOUD || "aws") as LegalRagConfig["cloud"],
    region: process.env.PINECONE_REGION || "us-east-1",
    embedModel: process.env.PINECONE_EMBED_MODEL || "llama-text-embed-v2",
    assistantModel: process.env.RAG_ASSISTANT_MODEL || "llama-3.3-70b-versatile",
    assistantTemperature: Number(process.env.RAG_ASSISTANT_TEMPERATURE || "0.2"),
    assistantMaxOutputTokens: Number(process.env.RAG_ASSISTANT_MAX_OUTPUT_TOKENS || "900"),
    topK: Number(process.env.RAG_ASSISTANT_TOPK || "8"),
  }
}

export function assertLegalRagEnv(config = getLegalRagConfig()) {
  const missing: string[] = []
  if (!config.pineconeApiKey) missing.push("PINECONE_API_KEY")
  if (!process.env.GROQ_API_KEY) missing.push("GROQ_API_KEY")
  return missing
}
