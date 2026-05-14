# Portable Next.js AI Assistant Kit

This folder is a reusable, project-agnostic AI assistant kit for any Next.js App Router project.

## What you get
- Reusable chat widget (`AssistantWidget`) with streaming UI
- Reusable server route factory (`createAssistantRoute`)
- Optional Pinecone-based RAG retriever (`createPineconeRetriever`)
- Env template + integration templates
- Step-by-step integration guide

## Core goals
- Plug into any Next.js app quickly
- Bring your own system prompt + knowledge
- Keep UI and backend decoupled from CapitalFusion-specific Redux/store

## Install dependencies in target project

```bash
npm i ai @ai-sdk/groq @pinecone-database/pinecone
```

## Quick integration order
1. Copy `src/client/*` and `src/server/*` into your target app (or import from this folder).
2. Add `.env` vars from `env.example`.
3. Create `app/api/assistant/route.ts` using `templates/route.ts.template`.
4. Add launcher component using `templates/AssistantLauncher.tsx.template`.
5. Replace prompt + route allowlist + knowledge collection to your domain.

Read full guide: `PORTABLE_INTEGRATION_GUIDE.md`.
