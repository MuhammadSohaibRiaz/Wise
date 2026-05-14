import { Pinecone } from '@pinecone-database/pinecone'
import type { RetrieveContextFn } from './types'

type PineconeRetrieverOptions = {
  embedText: (text: string) => Promise<number[]>
  indexName?: string
  namespace?: string
  collectionFilter?: string
}

export function createPineconeRetriever(options: PineconeRetrieverOptions): RetrieveContextFn {
  return async (query: string, topK: number) => {
    const apiKey = process.env.PINECONE_API_KEY
    const indexName = options.indexName || process.env.PINECONE_INDEX

    if (!apiKey || !indexName) {
      return []
    }

    const pc = new Pinecone({ apiKey })
    const index = pc.Index(indexName)
    const namespace = options.namespace || process.env.PINECONE_NAMESPACE || 'default'

    const vector = await options.embedText(query)
    const ns = index.namespace(namespace)

    const response = await ns.query({
      vector,
      topK,
      includeMetadata: true,
      filter: options.collectionFilter
        ? { collection: { $eq: options.collectionFilter } }
        : undefined,
    })

    return (response.matches || [])
      .map((m: any) => ({
        id: m.id,
        text: String(m?.metadata?.text || ''),
        score: Number(m?.score || 0),
        collection: String(m?.metadata?.collection || 'knowledge'),
      }))
      .filter((item) => item.text.length > 0)
  }
}
