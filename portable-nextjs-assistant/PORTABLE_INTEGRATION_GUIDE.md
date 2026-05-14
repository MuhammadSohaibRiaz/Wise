# Portable AI Assistant Integration Guide (Any Next.js Project)

This guide makes the assistant reusable in any Next.js App Router project.

## 1) Copy folder into target project

Copy:
- `portable-nextjs-assistant/`

Recommended target path:
- `<your-project>/portable-nextjs-assistant`

## 2) Install dependencies

```bash
npm i ai @ai-sdk/groq @pinecone-database/pinecone
```

## 3) Add environment variables

Create/update `.env.local` from `portable-nextjs-assistant/env.example`:

```env
GROQ_API_KEY="gsk_xxx"
PINECONE_API_KEY="..."
PINECONE_INDEX="..."
PINECONE_NAMESPACE="default"
ASSISTANT_MODEL="llama-3.3-70b-versatile"
ASSISTANT_TEMPERATURE="0.3"
ASSISTANT_TOPK="7"
```

## 4) Create assistant API route

Create file in your app:
- `src/app/api/assistant/route.ts`

Use:
- `portable-nextjs-assistant/templates/route.ts.template`

Important:
- Implement `embedText(text)` in that route using your embedding provider.
- Keep `runtime = 'nodejs'`.

## 5) Feed your own project data (knowledge)

### Option A (simple)
- Store chunks in Pinecone metadata field `text`
- Add metadata `collection: 'knowledge_base'`
- Keep template retriever filter `collectionFilter: 'knowledge_base'`

### Option B (multiple domains)
- Use metadata like:
  - `collection: 'billing'`
  - `collection: 'onboarding'`
  - `collection: 'api_docs'`
- Remove strict filter or choose one per route.

## 6) Add UI launcher component

Create component:
- `src/components/AssistantLauncher.tsx`

Use:
- `portable-nextjs-assistant/templates/AssistantLauncher.tsx.template`

Then mount it in your root layout/page (client area).

## 7) Configure behavior for your project

Edit these files:

- `portable-nextjs-assistant/src/server/defaults.ts`
  - `defaultSystemPrompt()` -> rewrite for your product rules
  - `defaultFastReply()` -> customize greetings and quick responses

- `portable-nextjs-assistant/src/client/AssistantWidget.tsx`
  - UI look, storage key, default greeting

## 8) Request/response contract

Frontend sends:

```json
{
  "messages": [{ "role": "user", "content": "..." }],
  "userContext": { "isAuthenticated": true, "userType": "customer" }
}
```

Route returns:
- Streaming text response (chunked)

## 9) Minimal test checklist

1. Open widget and send greeting -> gets response.
2. Ask domain-specific question -> retrieves KB-backed answer.
3. Restart browser tab -> chat restores from session storage.
4. Remove internet / break API key -> graceful error in UI.

## 10) Common portability notes

- This kit is independent from Redux and your existing UI kit.
- If you use shadcn/Tailwind, you can restyle the widget to match your design system.
- If you want multi-tenant prompts, pass tenant info in `userContext` and branch inside `getSystemPrompt`.

---

## What this kit already solves

- Reusable streaming assistant UI
- Generic server route factory
- Pluggable RAG retriever
- Prompt/context merge pattern
- Fast-reply and emergency-reply hooks

## What you must provide per project

- Embedding function implementation
- Pinecone index and chunk ingestion pipeline
- Product-specific system prompt and policies
