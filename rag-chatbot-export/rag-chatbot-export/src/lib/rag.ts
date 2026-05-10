import { getPineconeIndex } from "./pinecone";
import { embedText } from "./embeddings";

export interface RetrievedContext {
  text: string;
  collection: string;
  id: string;
  score: number;
}

export async function retrieveContext(
  query: string,
  topK: number = 7
): Promise<RetrievedContext[]> {
  try {
    const queryEmbedding = await embedText(query);
    const index = await getPineconeIndex();

    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
    });

    return queryResponse.matches
      .map((match: any) => ({
        text: match.metadata?.text || "",
        collection: match.metadata?.collection || "unknown",
        id: match.id,
        score: match.score || 0,
      }))
      .filter((ctx: RetrievedContext) => ctx.text.length > 0);
  } catch (err) {
    console.error("RAG retrieval error:", err);
    return [];
  }
}

export async function retrieveByCollection(
  query: string,
  collection: string,
  topK: number = 10
): Promise<RetrievedContext[]> {
  try {
    const queryEmbedding = await embedText(query);
    const index = await getPineconeIndex();

    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
      filter: { collection: { $eq: collection } },
    });

    return queryResponse.matches
      .map((match: any) => ({
        text: match.metadata?.text || "",
        collection: match.metadata?.collection || "unknown",
        id: match.id,
        score: match.score || 0,
      }))
      .filter((ctx: RetrievedContext) => ctx.text.length > 0);
  } catch (err) {
    console.error("RAG filtered retrieval error:", err);
    return [];
  }
}


export function formatContextForPrompt(contexts: RetrievedContext[]): string {
  if (contexts.length === 0) return "";

  const grouped = contexts.reduce(
    (acc: any, ctx: RetrievedContext) => {
      if (!acc[ctx.collection]) acc[ctx.collection] = [];
      acc[ctx.collection].push(ctx.text);
      return acc;
    },
    {}
  );

  return `## Retrieved Context from Website
${Object.entries(grouped)
  .map(
    ([collection, texts]: [string, any]) =>
      `### ${collection}\n${(texts as string[]).map((t: string) => `- ${t}`).join("\n")}`
  )
  .join("\n\n")}`;
}