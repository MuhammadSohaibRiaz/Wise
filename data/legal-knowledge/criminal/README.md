# Criminal Law and Evidence Sources

Place Pakistani criminal-law and evidence source files here before running ingestion.

Recommended files:

- `Pakistan Penal Code.md`
- `Code of Criminal Procedure, 1898.md`
- `Qanun-e-Shahadat Order, 1984.md`

Supported formats:

- `.pdf` text-based PDFs
- `.txt`
- `.md`

Run:

```bash
npm run rag:ingest
npm run rag:check
```

Required environment variables:

```env
PINECONE_API_KEY=
PINECONE_INDEX=wisecase-legal-rag
PINECONE_NAMESPACE=criminal-law
PINECONE_CLOUD=aws
PINECONE_REGION=us-east-1
PINECONE_EMBED_MODEL=llama-text-embed-v2
RAG_ASSISTANT_MODEL=llama-3.3-70b-versatile
RAG_ASSISTANT_TEMPERATURE=0.2
RAG_ASSISTANT_MAX_OUTPUT_TOKENS=900
RAG_ASSISTANT_TOPK=8
GROQ_API_KEY=
```
