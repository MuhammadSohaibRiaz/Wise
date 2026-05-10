import { streamText } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { getInitialMessage } from "@/lib/chatBotData";
import { retrieveContext, formatContextForPrompt } from "@/lib/rag";
import { getPineconeIndex } from "@/lib/pinecone";
import { embedText } from "@/lib/embeddings";

// Parse multiple API keys from environment variable
const apiKeys = (process.env.GROQ_API_KEY || "")
  .split(",")
  .map((key) => key.trim())
  .filter(Boolean);
let currentKeyIndex = 0;

// Round-robin function to get next API key
function getNextApiKey(): string {
  if (apiKeys.length === 0) {
    throw new Error("No GROQ API keys configured");
  }
  const key = apiKeys[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
  return key;
}

export const runtime = "nodejs"; // Changed from "edge" because RAG needs Node.js

const mapMessages = (messages: any[]) =>
  messages
    .map((m) => ({
      role: (m.role ?? "user") as "user" | "assistant" | "system",
      content: m.content || m.text || "",
    }))
    .filter((m) => m.content.trim().length > 0);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const messages = mapMessages(body.messages || []);

    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: "No valid messages provided" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    // Get the latest user message for RAG
    const lastUserMessage = messages.filter((m) => m.role === "user").slice(-1)[0];
    const query = lastUserMessage?.content || "";

    // Retrieve relevant context from Pinecone
        // Retrieve relevant context from Pinecone
    let contextPrompt = "";
    if (query) {
      let contexts = await retrieveContext(query, 7);
      
      // If query is about services, fetch more service vectors
      const serviceIntent = /\b(service|services|offer|provide|what do you do|what do you offer|list|tell me about)\b/i;
      if (serviceIntent.test(query)) {
        try {
          const index = await (await import("../../../../lib/pinecone")).getPineconeIndex();
          const queryEmbedding = await (await import("../../../../lib/embeddings")).embedText(query);
          const queryResponse = await index.query({
            vector: queryEmbedding,
            topK: 10,
            includeMetadata: true,
            filter: { collection: { $eq: "services" } },
          });
          contexts = queryResponse.matches
            .map((match: any) => ({
              text: match.metadata?.text || "",
              collection: match.metadata?.collection || "unknown",
              id: match.id,
              score: match.score || 0,
            }))
            .filter((ctx: any) => ctx.text.length > 0);
        } catch (err) {
          // Fallback to default contexts if filtering fails
        }
      }

      contextPrompt = formatContextForPrompt(contexts);
    }

    // Create Groq instance with next API key in rotation
    const groq = createGroq({
      apiKey: getNextApiKey(),
    });

    const model = groq("llama-3.3-70b-versatile");

    // Get the base system message
    const systemMessage = getInitialMessage();

    // Augment system prompt with retrieved context
    const augmentedSystem = contextPrompt
      ? `${systemMessage.content}\n\n${contextPrompt}`
      : systemMessage.content;

    const stream = await streamText({
      model,
      system: augmentedSystem,
      messages,
      temperature: 0.3,
    });

    return stream.toTextStreamResponse();
  } catch (err) {
    console.error("Chat API error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal Server Error",
      }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}