import { SERVICES_LIST } from "../content/services";
import { embedText } from "./embeddings";
import { getPineconeIndex } from "./pinecone";

/**
 * Embeds all static services data into Pinecone.
 * Call this once, or whenever services.ts changes.
 */
export async function syncServicesToVectorDB() {
  console.log("Syncing services to Pinecone...");

  const index = await getPineconeIndex();

  // Delete old service vectors first
  try {
    await index.deleteMany({
      filter: { collection: { $eq: "services" } },
    });
    console.log("Deleted old service vectors");
  } catch {
    console.log("No old service vectors to delete");
  }

  const vectors: Array<{
    id: string;
    values: number[];
    metadata: Record<string, any>;
  }> = [];

  for (let i = 0; i < SERVICES_LIST.length; i++) {
    const service = SERVICES_LIST[i];
    const text = [
      `Service: ${service.name}`,
      `Description: ${service.description}`,
      `Tags: ${service.tags.join(", ")}`,
    ].join("\n");

    console.log(`Embedding service ${i + 1}/${SERVICES_LIST.length}: ${service.name}`);

    try {
      const embedding = await embedText(text);

      if (!Array.isArray(embedding) || embedding.length === 0) {
        console.error(`Invalid embedding for service: ${service.name}`);
        continue;
      }

      vectors.push({
        id: `services#${i}`,
        values: embedding,
        metadata: {
          text,
          collection: "services",
          docId: String(i),
          title: service.name,
          chunkIndex: 0,
          totalChunks: 1,
        },
      });
    } catch (err: any) {
      console.error(`Failed to embed service ${service.name}: ${err.message}`);
    }
  }

  if (vectors.length > 0) {
    await index.upsert({ records: vectors });
    console.log(`Synced ${vectors.length} services to Pinecone`);
  } else {
    console.error("No service vectors produced");
  }
}