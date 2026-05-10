# RAG Chatbot Implementation Guide

This document explains how the RAG chatbot in this project works, what each file does, and how to migrate it to another website.

## 1) What This Implementation Includes

- Chat UI widget (floating button + chat panel)
- Streaming chat API using Groq via AI SDK
- Retrieval-Augmented Generation (RAG) from Pinecone vector store
- Embedding generation with Hugging Face Inference API
- CMS content sync hooks (Payload) that keep vectors fresh
- Static services indexing script
- Optional meeting booking flow from chat

## 2) High-Level Architecture

1. User sends a message from the chat widget.
2. Frontend posts messages to `/api/chat`.
3. API route retrieves top matching context chunks from Pinecone.
4. API route injects retrieved context into system prompt.
5. LLM response is streamed back to the frontend.
6. CMS hooks keep vectors updated on create/update/delete.
7. Optional script syncs static services content into Pinecone.

## 3) Core Runtime Flow

### Chat Request Flow

1. `Chat.tsx` sends recent conversation to `/api/chat`.
2. `route.ts` extracts latest user query.
3. `rag.ts` embeds query and queries Pinecone (`topK` matches).
4. Retrieved chunks are grouped into prompt text.
5. `chatBotData.ts` system prompt + retrieved context are sent to Groq model.
6. Streamed text is rendered progressively in UI.

### Indexing Flow (CMS Content)

1. Payload collection `afterChange` hook triggers `syncToVectorDB`.
2. Existing vectors for that doc are deleted by `collection + docId` filter.
3. Document text is extracted by `documentIndexer.ts`.
4. Text is chunked (`chunkText`) and embedded (`embedText`).
5. Chunks are upserted to Pinecone with metadata.

### Deletion Flow

1. Payload collection `afterDelete` hook triggers `deleteFromVectorDB`.
2. All vectors matching `collection + docId` are removed.

## 4) Environment Variables

Required for RAG chat:

- `GROQ_API_KEY`
  - Supports comma-separated keys for round-robin usage.
- `HUGGING_FACE_API_KEY`
- `PINECONE_API_KEY`
- `PINECONE_HOST` (preferred) or `PINECONE_INDEX`

Required for meeting booking endpoint:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `FROM_EMAIL` (optional fallback to SMTP user)
- `MEETING_NOTIFY_EMAIL` (optional fallback to SMTP user)

## 5) Vector Record Shape

Upserted vectors use metadata similar to:

- `text`: chunk text
- `collection`: source collection slug (`blogs`, `projects`, `team`, `services`)
- `docId`: source document id
- `chunkIndex`
- `totalChunks`
- `title`

Vector id pattern:

- Dynamic content: `<collection>#<docId>#<chunkIndex>`
- Services content: `services#<index>`

## 6) Files Included In Export

Backend and RAG core:

- `src/app/(frontend)/api/chat/route.ts`
- `src/lib/rag.ts`
- `src/lib/pinecone.ts`
- `src/lib/embeddings.ts`
- `src/lib/chatBotData.ts`
- `src/lib/documentIndexer.ts`
- `src/hooks/syncToVectorDB.ts`
- `src/lib/syncServices.ts`
- `src/scripts/syncServices.ts`
- `src/content/services.ts`

UI and integration:

- `src/components/chatbot/chatbot.tsx`
- `src/components/chatbot/Chat.tsx`
- `src/components/chatbot/MeetingForm.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/card.tsx`
- `src/lib/utils.ts`
- `src/app/(frontend)/layout.tsx`

CMS integration points:

- `src/collections/Blogs/index.ts`
- `src/collections/Projects/index.ts`
- `src/collections/Team/index.ts`

Dependency reference:

- `package.json`

## 7) Migration Steps (Another Website)

1. Copy exported files into your target project, preserving paths where possible.
2. Install required packages (minimum):
   - `ai`
   - `@ai-sdk/groq`
   - `@pinecone-database/pinecone`
   - `@radix-ui/react-slot`
   - `class-variance-authority`
   - `clsx`
   - `tailwind-merge`
   - `react-markdown`
   - `remark-gfm`
   - `lucide-react`
   - `zod`
   - `nodemailer` (only if using meeting endpoint)
3. Add environment variables listed above.
4. Ensure your vector index dimension matches the Hugging Face model output dimension.
5. Mount `Chatbot` in your root layout/page.
6. Add `/api/chat` route.
7. If using Payload CMS, wire hooks in collections to `syncToVectorDB` and `deleteFromVectorDB`.
8. Run one-time static services sync with script:
   - `pnpm sync-services`
9. Verify by asking chatbot questions tied to your indexed data.

## 8) Important Notes and Gotchas

- Chat route uses `runtime = "nodejs"`; do not run this endpoint on edge runtime.
- Retrieval quality depends heavily on text extraction and chunking quality.
- If Pinecone host is available, prefer `PINECONE_HOST` for direct index access.
- If no context is retrieved, model still answers from system instructions; adjust prompt policy if strict grounding is needed.
- Meeting form markers (`[SHOW_MEETING_BUTTON]`, `[OPEN_MEETING_FORM]`) are hidden control tokens consumed by UI.

## 9) Recommended Improvements For Reuse

- Add strict context-grounded mode (refuse unsupported claims).
- Add retry/backoff around embedding and vector operations.
- Add server-side rate limiting on `/api/chat`.
- Add observability (latency, retrieval hit rates, token usage).
- Expand `extractDocumentText` to include rich text/blog/page content if needed.

## 10) Quick Validation Checklist

- Chat endpoint returns streamed response.
- Pinecone query returns matches with `metadata.text`.
- Creating/updating/deleting docs updates vectors correctly.
- Service sync script creates `services` vectors.
- Meeting form successfully sends email (if enabled).
