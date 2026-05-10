import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
} from "payload";
import pineconeModule from "../lib/pinecone";
import embeddingsModule from "../lib/embeddings";
import documentIndexerModule from "../lib/documentIndexer";

// Safely extract functions - handles Webpack default/named export resolution
const getPineconeIndex =
  (pineconeModule as any)?.getPineconeIndex ?? pineconeModule;
const embedText = (embeddingsModule as any)?.embedText ?? embeddingsModule;
const extractDocumentText =
  (documentIndexerModule as any)?.extractDocumentText;
const chunkText = (documentIndexerModule as any)?.chunkText;

/**
 * afterChange hook — syncs a document to Pinecone when created or updated.
 * 1. Deletes all old vectors for this doc (cleans stale chunks)
 * 2. Extracts text, chunks it, embeds each chunk
 * 3. Upserts fresh vectors to Pinecone
 */
export const syncToVectorDB: CollectionAfterChangeHook = async ({
  doc,
  operation,
  collection,
  req: { payload },
}) => {
  payload.logger.info(
    `syncToVectorDB FIRED: ${collection.slug} #${doc.id} (${operation})`
  );

  // Validate imports
  if (typeof extractDocumentText !== "function") {
    payload.logger.error(
      `extractDocumentText is not a function. Keys: ${JSON.stringify(Object.keys(documentIndexerModule || {}))}`
    );
    return doc;
  }
  if (typeof embedText !== "function") {
    payload.logger.error(
      `embedText is not a function. Keys: ${JSON.stringify(Object.keys(embeddingsModule || {}))}`
    );
    return doc;
  }
  if (typeof getPineconeIndex !== "function") {
    payload.logger.error(
      `getPineconeIndex is not a function. Keys: ${JSON.stringify(Object.keys(pineconeModule || {}))}`
    );
    return doc;
  }

  try {
    const index = await getPineconeIndex();

    // Step 1: Delete all old vectors for this document (prevents stale chunks)
    try {
      await index.deleteMany({
        filter: {
          collection: { $eq: collection.slug },
          docId: { $eq: doc.id },
        },
      });
      payload.logger.info(
        `Deleted old vectors for ${collection.slug} #${doc.id}`
      );
    } catch (delErr: any) {
      // If delete fails (e.g. no matching vectors), continue with upsert
      payload.logger.info(
        `No old vectors to delete (or delete failed): ${delErr.message || delErr}`
      );
    }

    // Step 2: Re-fetch the document with populated relationships (depth: 1)
    let populatedDoc = doc;
    try {
      populatedDoc = await payload.findByID({
        collection: collection.slug as any,
        id: doc.id,
        depth: 1,
      });
    } catch {
      payload.logger.info(
        `Could not populate relationships for ${collection.slug} #${doc.id}, using raw doc`
      );
    }

    // Step 2: Extract text from the document
    const textParts = extractDocumentText(populatedDoc, collection.slug);
    const fullText = textParts.join("\n");

    if (!fullText) {
      payload.logger.info(
        `No text to index for ${collection.slug} #${doc.id}`
      );
      return doc;
    }

    payload.logger.info(
      `Text extracted (${fullText.length} chars): ${fullText.substring(0, 100)}...`
    );

    // Step 3: Chunk and embed
    const chunks = chunkText(fullText, 300);
    payload.logger.info(`Chunks created: ${chunks.length}`);

    const vectors: Array<{
      id: string;
      values: number[];
      metadata: Record<string, any>;
    }> = [];

    for (let i = 0; i < chunks.length; i++) {
      try {
        const embedding = await embedText(chunks[i]);

        if (!Array.isArray(embedding) || embedding.length === 0) {
          payload.logger.error(`Invalid embedding for chunk ${i}`);
          continue;
        }

        vectors.push({
          id: `${collection.slug}#${doc.id}#${i}`,
          values: embedding,
          metadata: {
            text: chunks[i],
            collection: collection.slug,
            docId: String(doc.id),
            chunkIndex: i,
            totalChunks: chunks.length,
            title: doc.title || doc.name || "Untitled",
          },
        });
      } catch (embErr: any) {
        payload.logger.error(
          `Embedding chunk ${i} failed: ${embErr.message || String(embErr)}`
        );
      }
    }

    payload.logger.info(`Vectors ready: ${vectors.length}`);

    // Step 4: Upsert fresh vectors
    if (vectors.length > 0) {
      await index.upsert({ records: vectors });
      payload.logger.info(
        `Synced ${collection.slug} #${doc.id} to Pinecone (${vectors.length} vectors)`
      );
    } else {
      payload.logger.error(
        `No valid vectors for ${collection.slug} #${doc.id} — skipping upsert`
      );
    }
  } catch (err: any) {
    payload.logger.error(
      `syncToVectorDB error: ${err.message || String(err)}`
    );
  }

  return doc;
};

/**
 * afterDelete hook — removes all vectors for a deleted document from Pinecone
 */
export const deleteFromVectorDB: CollectionAfterDeleteHook = async ({
  doc,
  collection,
  req: { payload },
}) => {
  payload.logger.info(
    `deleteFromVectorDB FIRED: ${collection.slug} #${doc.id}`
  );

  if (typeof getPineconeIndex !== "function") {
    payload.logger.error("getPineconeIndex is not a function");
    return doc;
  }

  try {
    const index = await getPineconeIndex();
    await index.deleteMany({
      filter: {
        collection: { $eq: collection.slug },
        docId: { $eq: String(doc.id) },
      },
    });
    payload.logger.info(
      `Deleted all vectors for ${collection.slug} #${doc.id} from Pinecone`
    );
  } catch (err: any) {
    payload.logger.error(
      `deleteFromVectorDB error: ${err.message || String(err)}`
    );
  }

  return doc;
};