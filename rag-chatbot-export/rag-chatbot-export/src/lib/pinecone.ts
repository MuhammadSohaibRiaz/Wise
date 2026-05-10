import { Pinecone } from "@pinecone-database/pinecone";

let cachedPinecone: Pinecone | null = null;

export function getPineconeClient(): Pinecone {
  if (cachedPinecone) return cachedPinecone;

  cachedPinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
  });

  return cachedPinecone;
}

export async function getPineconeIndex() {
  const client = getPineconeClient();

  // If host is provided, use it directly (fastest, no extra API call)
  if (process.env.PINECONE_HOST) {
    return client.index({ host: process.env.PINECONE_HOST });
  }

  // Otherwise resolve by name using v7 options syntax
  return client.index({ name: process.env.PINECONE_INDEX! });
}

export default { getPineconeClient, getPineconeIndex };