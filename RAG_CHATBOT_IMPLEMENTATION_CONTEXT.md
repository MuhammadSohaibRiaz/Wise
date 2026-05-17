  # WiseCase RAG Chatbot Implementation Context

  ## 1. What We Built

  WiseCase now has a new **Legal RAG Assistant** that is separate from the original chatbot, but it has started absorbing the original chatbot's useful WiseCase platform features.

  The assistant has two major modes:

  1. **Legal RAG mode**
    - Answers questions from indexed Pakistani legal materials.
    - Uses Pinecone as the knowledge base and retrieval layer.
    - Uses Groq as the LLM to generate final answers from retrieved context.
    - Refuses or limits answers when the knowledge base does not contain enough relevant material.

  2. **WiseCase platform assistant mode**
    - Helps users with WiseCase-specific tasks.
    - Can search lawyers, show lawyer reviews, check/update profile fields, show recent cases/appointments, summarize case document analyses, answer WiseCase FAQ/policy questions, and guide users through platform routes.
    - Uses Supabase-backed AI tools from the existing chatbot system.
    - Private user actions require authentication.

  The old chatbot is still present for now. The new RAG assistant is designed as the migration target. Once it is fully tested and accepted, the old chatbot can be removed or merged.

  ## 2. Core Files

  ### API Route

  ```text
  app/api/legal-rag-chat/route.ts
  ```

  Purpose:

  - Receives chat messages from the RAG assistant UI.
  - Authenticates the user if a Supabase session exists.
  - Applies rate limiting.
  - Classifies the user query.
  - Routes the query to:
    - greeting template,
    - capability template,
    - refusal template,
    - Pinecone legal RAG retrieval,
    - or WiseCase platform tool mode.
  - Streams the response back to the UI.
  - Saves authenticated chat history to `ai_chat_messages`.

  ### RAG UI

  ```text
  components/rag/legal-rag-assistant.tsx
  components/rag/legal-rag-launcher.tsx
  ```

  Purpose:

  - Floating Legal RAG Assistant widget.
  - Streams assistant responses.
  - Supports authenticated chat history.
  - Supports guest session storage.
  - Supports clear history.
  - Supports document upload and analysis.
  - Supports action buttons like `[ACTION:View Profile:/client/lawyer/id]`.
  - Supports `[VIEW_ANALYSIS:documentId]` buttons.
  - Supports voice input and text-to-speech.

  ### RAG Knowledge Helpers

  ```text
  lib/rag/config.ts
  lib/rag/pinecone.ts
  lib/rag/knowledge-processing.ts
  ```

  Purpose:

  - Load RAG environment configuration.
  - Connect to Pinecone.
  - Search Pinecone records.
  - Format retrieved legal context for the LLM.
  - Normalize and chunk legal source files during ingestion.

  ### Ingestion Scripts

  ```text
  scripts/rag/ingest-legal-knowledge.ts
  scripts/rag/check-pinecone.ts
  ```

  Purpose:

  - Read legal source files from `data/legal-knowledge`.
  - Extract text from `.md`, `.txt`, and text-based `.pdf` files.
  - Chunk legal content.
  - Create or validate Pinecone integrated-embedding index.
  - Upsert records into Pinecone.
  - Check retrieval quality with sample queries.

  ### Existing WiseCase Tool Layer

  ```text
  lib/ai/tools.ts
  ```

  Purpose:

  - Provides Supabase-backed tools used by the platform assistant mode.
  - Includes:
    - `getProfileStatus`
    - `updateProfile`
    - `getMyDataSummary`
    - `searchLawyers`
    - `searchReviews`
    - `getPlatformFAQ`
    - `getCaseAnalysisSummary`

  Security hardening added:

  - `getCaseAnalysisSummary` now validates that the signed-in user belongs to the requested case before returning document analysis data.
  - Recent case lookup now correctly fetches cases where the user is either client or lawyer.

  ### Shared Chat History Route

  ```text
  app/api/chat/history/route.ts
  ```

  Purpose:

  - Loads authenticated chat history.
  - Clears authenticated chat history.
  - Validates case context before returning case-scoped messages.

  The RAG assistant reuses this route for persisted history.

  ## 3. Knowledge Base Structure

  Legal source files live under:

  ```text
  data/legal-knowledge/
  ```

  Current category folders:

  ```text
  data/legal-knowledge/criminal/
  data/legal-knowledge/family/
  data/legal-knowledge/tax/
  data/legal-knowledge/labour/
  data/legal-knowledge/immigration/
  data/legal-knowledge/civil/
  ```

  Current indexed materials include:

  ```text
  civil/Contract Act, 1872.md
  criminal/Code of Criminal Procedure, 1898.md
  criminal/Pakistan Penal Code.md
  criminal/Qanun-e-Shahadat Order, 1984.md
  family/Dissolution of Muslim Marriages Act, 1939.md
  family/Muslim Family Laws Ordinance, 1961.md
  family/West Pakistan Family Courts Act, 1964.md
  immigration/Emigration Rules, 1979 updated 2023.md
  labour/Industrial Relations Act, 2012.md
  tax/Income Tax Ordinance, 2001.md
  tax/Sales Tax Act, 1990.md
  ```

  The image-only Guardians and Wards Act PDF was intentionally skipped for now because it requires OCR.

  ## 4. Pinecone Design

  We use Pinecone as the vector database and retrieval system.

  The implementation uses **Pinecone integrated embeddings**, meaning WiseCase sends text records to Pinecone and Pinecone handles embedding internally.

  Default env values:

  ```env
  PINECONE_API_KEY=
  PINECONE_INDEX=wisecase-legal-rag
  PINECONE_NAMESPACE=pakistan-legal-kb
  PINECONE_CLOUD=aws
  PINECONE_REGION=us-east-1
  PINECONE_EMBED_MODEL=llama-text-embed-v2
  RAG_ASSISTANT_MODEL=llama-3.3-70b-versatile
  RAG_ASSISTANT_TEMPERATURE=0.2
  RAG_ASSISTANT_TOPK=8
  RAG_ASSISTANT_MAX_OUTPUT_TOKENS=900
  ```

  Record shape:

  ```ts
  {
    id: "category:source-slug:chunk-index:hash",
    chunk_text: "...",
    jurisdiction: "Pakistan",
    category: "criminal | family | tax | labour | immigration | civil",
    source_type: "book",
    source_title: "...",
    source_file: "...",
    act_name: "... | null",
    section_ref: "... | null",
    chapter_title: "... | null",
    chunk_index: 0
  }
  ```

  The `chunk_text` field is the embedded field.

  ## 5. Ingestion Flow

  Run:

  ```bash
  npm run rag:ingest
  ```

  Other scripts:

  ```bash
  npm run rag:check
  npm run rag:ingest:reset
  npm run rag:ingest:recreate
  ```

  Behavior:

  1. Reads all supported files from `data/legal-knowledge`.
  2. Detects category from folder name.
  3. Extracts text.
  4. Normalizes whitespace.
  5. Chunks by legal structure where possible:
    - act/title headings,
    - chapter headings,
    - section headings,
    - fallback chunking when structure is unclear.
  6. Creates deterministic record IDs.
  7. Creates/recreates Pinecone index if requested.
  8. Upserts records into namespace.
  9. Handles Pinecone token-per-minute limits by batching and waiting.

  The successful full ingestion produced:

  ```text
  Files found: 11
  Extracted characters: 4216673
  Chunks generated: 1647
  Records upserted: 1647
  ```

  ## 6. Legal RAG Answer Flow

  When a user asks a legal question:

  1. UI sends messages to:

  ```text
  POST /api/legal-rag-chat
  ```

  2. Server normalizes messages and extracts latest user query.
  3. Server authenticates user if possible.
  4. Server classifies query:
    - greeting,
    - capability question,
    - jailbreak/security attempt,
    - off-topic,
    - non-Pakistani law,
    - WiseCase platform task,
    - or legal RAG retrieval.
  5. For legal RAG retrieval:
    - Pinecone searches indexed legal records.
    - Results below confidence threshold are treated as insufficient.
    - Retrieved chunks are formatted as legal context.
    - Groq generates a concise answer from the retrieved context.
    - Response includes citations and disclaimer.
  6. Authenticated messages are saved to `ai_chat_messages`.

  ## 7. WiseCase Platform Assistant Flow

  When a user asks a WiseCase platform question:

  Examples:

  ```text
  Find lawyers for family law.
  Show reviews for a criminal lawyer.
  Check my profile completion.
  Update my phone to 03001234567.
  Show my recent cases and appointments.
  Summarize my case document analyses.
  What is WiseCase refund policy?
  ```

  The route switches to platform tool mode.

  Guest users can use only public tools:

  - `searchLawyers`
  - `searchReviews`
  - `getPlatformFAQ`

  Authenticated users can use all tools:

  - public tools,
  - profile tools,
  - case/appointment summary tools,
  - document analysis summary tools.

  Private operations require Supabase authentication.

  ## 8. UI Capabilities

  The new RAG assistant UI supports:

  - Floating launcher.
  - Streaming responses.
  - Guest session chat via `sessionStorage`.
  - Authenticated chat history from database.
  - Clear chat history.
  - Load older history.
  - Starter prompts.
  - Legal disclaimer footer.
  - Document upload.
  - Document analysis polling.
  - View Analysis button.
  - Safe action buttons.
  - Safe internal navigation markers.
  - Voice input.
  - Text-to-speech.

  It uses a distinct label:

  ```text
  Legal RAG Assistant
  Pakistan Legal KB + WiseCase tools
  ```

  This helps distinguish it from the old chatbot during testing.

  ## 9. Safety And Hallucination Controls

  The assistant is intentionally designed not to freely answer legal questions outside the KB.

  Main safeguards:

  - Legal answers should come from retrieved Pinecone context.
  - If retrieval is missing or weak, assistant says the KB does not contain that reference yet.
  - It should not invent:
    - sections,
    - punishments,
    - case law,
    - dates,
    - citations,
    - legal tests.
  - It refuses:
    - off-topic prompts,
    - jailbreak attempts,
    - system prompt requests,
    - API key or secret requests,
    - non-Pakistani law requests.
  - It always includes a legal disclaimer in legal answers.
  - It distinguishes legal information from legal advice.

  Important design decision:

  Groq is **not** used as an open legal knowledge fallback. Groq is used to generate answers from retrieved KB context. If the KB does not contain the answer, the safer behavior is to say so instead of hallucinating.

  ## 10. Why We Use Groq

  Groq is used as the LLM provider.

  Default model:

  ```text
  llama-3.3-70b-versatile
  ```

  Use cases:

  - Generate natural language answers from retrieved legal chunks.
  - Summarize retrieved context.
  - Use WiseCase platform tools and explain results.
  - Stream responses quickly.

  Groq does not store the legal KB. Pinecone stores the searchable legal chunks.

  ## 11. Why We Use Pinecone

  Pinecone is used because:

  - It provides vector search.
  - It supports integrated embeddings.
  - It avoids maintaining our own embedding pipeline.
  - It can scale beyond the initial FYP corpus.
  - It supports namespaces and metadata filters.

  For the FYP, this keeps the RAG system practical:

  - Markdown/PDF files go in `data/legal-knowledge`.
  - Ingestion script chunks and upserts.
  - Runtime route searches Pinecone.
  - Groq answers from retrieved context.

  ## 12. Strengths

  ### Legal Answer Quality

  - Answers are grounded in indexed Pakistani legal materials.
  - Citations are included when available.
  - The assistant avoids free-form uncited legal claims.

  ### Multi-Domain Corpus

  Current corpus covers:

  - criminal law,
  - criminal procedure,
  - evidence,
  - family law,
  - tax law,
  - labour law,
  - immigration/emigration,
  - contract/civil disputes.

  ### Platform Integration

  The assistant is not just a legal Q&A bot. It also supports WiseCase workflows:

  - lawyer search,
  - reviews,
  - profile completion,
  - appointments/cases summary,
  - document analysis,
  - platform FAQ,
  - chat history,
  - upload flow,
  - voice/TTS.

  ### Safer Migration Path

  The old chatbot remains available while the new RAG assistant is tested. This reduces risk.

  ### Better Evaluation Story

  For an FYP evaluator, the system demonstrates:

  - RAG pipeline,
  - legal corpus ingestion,
  - vector retrieval,
  - LLM response generation,
  - user authentication,
  - role-aware behavior,
  - document analysis integration,
  - cross-feature platform assistant behavior.

  ## 13. Weaknesses And Limitations

  ### KB Coverage Is Limited

  The assistant can only answer legal questions well if the source exists in the indexed KB.

  If a law, amendment, schedule, rule, or case law is missing, the assistant should say:

  ```text
  The current knowledge base does not contain that reference yet.
  ```

  ### No Live Legal Updates

  The corpus is manually ingested. It does not automatically fetch new amendments, Gazette updates, FBR circulars, or court judgments.

  ### No OCR Pipeline Yet

  Image-only PDFs are not supported in v1. The Guardians and Wards Act PDF was skipped because it requires OCR.

  Future improvement:

  - Add OCR using Tesseract or a document OCR service.
  - Store extracted Markdown after OCR.
  - Ingest OCR-verified text.

  ### Retrieval Can Still Miss Relevant Sections

  Even with chunking, vector search may sometimes retrieve broad or adjacent material instead of the exact section.

  Mitigations already used:

  - Smaller legal-aware chunks.
  - Metadata.
  - Confidence threshold.
  - Top-K retrieval.

  Future improvement:

  - Add reranking.
  - Add exact section lookup.
  - Add hybrid search with keyword + vector retrieval.

  ### Metadata Depends On Source Quality

  Markdown converted from PDFs may contain noisy headings. That can affect:

  - `act_name`,
  - `section_ref`,
  - `chapter_title`,
  - citation quality.

  Future improvement:

  - Clean each Markdown source.
  - Add source manifest files.
  - Add manual metadata overrides.

  ### Legal Advice Boundary

  The assistant provides general legal information, not legal advice.

  For specific user cases, the system should recommend consulting a qualified Pakistani lawyer.

  ### Platform Tool Reliability Depends On Database Data

  WiseCase platform answers depend on:

  - Supabase data,
  - profile completeness,
  - lawyer verification records,
  - appointment/case records,
  - document analysis records.

  If test data is incomplete, the assistant may correctly say no data is available.

  ## 14. Current Deployment Requirements

  Required environment variables:

  ```env
  GROQ_API_KEY=
  PINECONE_API_KEY=
  PINECONE_INDEX=wisecase-legal-rag
  PINECONE_NAMESPACE=pakistan-legal-kb
  PINECONE_CLOUD=aws
  PINECONE_REGION=us-east-1
  PINECONE_EMBED_MODEL=llama-text-embed-v2
  RAG_ASSISTANT_MODEL=llama-3.3-70b-versatile
  RAG_ASSISTANT_TEMPERATURE=0.2
  RAG_ASSISTANT_TOPK=8
  RAG_ASSISTANT_MAX_OUTPUT_TOKENS=900
  ```

  Also required by existing WiseCase features:

  ```env
  NEXT_PUBLIC_SUPABASE_URL=
  NEXT_PUBLIC_SUPABASE_ANON_KEY=
  SUPABASE_SERVICE_ROLE_KEY=
  STRIPE_SECRET_KEY=
  STRIPE_WEBHOOK_SECRET=
  RESEND_API_KEY=
  ```

  The exact required set depends on which features are used in production.

  ## 15. Package And Deployment Notes

  Added dependencies:

  ```text
  @pinecone-database/pinecone
  tsx
  ```

  Added package scripts:

  ```json
  {
    "rag:check": "tsx scripts/rag/check-pinecone.ts",
    "rag:ingest": "tsx scripts/rag/ingest-legal-knowledge.ts",
    "rag:ingest:recreate": "tsx scripts/rag/ingest-legal-knowledge.ts --recreate-index",
    "rag:ingest:reset": "tsx scripts/rag/ingest-legal-knowledge.ts --reset"
  }
  ```

  Vercel install fix:

  ```json
  "packageManager": "pnpm@9.15.9"
  ```

  `pnpm-lock.yaml` was updated so Vercel frozen install can match `package.json`.

  ## 16. Current Test Status

  Verified locally:

  ```bash
  npm run build
  ```

  Build passes.

  Ingestion was tested with the current corpus and successfully upserted records to Pinecone.

  RAG check returned hits for sample legal queries.

  Full manual system testing is still required using:

  ```text
  SYSTEM_TEST_PLAN.md
  ```

  ## 17. How To Add More Laws

  Recommended process:

  1. Download official PDF or reliable source.
  2. Convert text-based PDF to Markdown.
  3. Put Markdown into the correct folder:

  ```text
  data/legal-knowledge/criminal/
  data/legal-knowledge/family/
  data/legal-knowledge/tax/
  data/legal-knowledge/labour/
  data/legal-knowledge/immigration/
  data/legal-knowledge/civil/
  ```

  4. Run:

  ```bash
  npm run rag:ingest
  ```

  5. Run:

  ```bash
  npm run rag:check
  ```

  6. Test in UI.

  For major corpus structure changes:

  ```bash
  npm run rag:ingest:recreate
  ```

  Use recreate carefully because it deletes and rebuilds the Pinecone index.

  ## 18. Suggested Future Improvements

  ### Retrieval Improvements

  - Add exact section lookup.
  - Add BM25/keyword search alongside vector search.
  - Add reranker after Pinecone retrieval.
  - Add source-tier metadata:
    - official statute,
    - Pakistan Code,
    - FBR source,
    - guidance/manual,
    - fallback source.

  ### Corpus Management

  - Add `source_manifest.json` for each source.
  - Store source URL, date downloaded, amendment date, publisher, and reliability tier.
  - Add scheduled refresh for tax/company/regulatory materials.

  ### OCR Support

  - Add OCR for scanned PDFs.
  - Save OCR output as Markdown.
  - Add manual review step before ingestion.

  ### Legal Citation Quality

  - Improve section extraction.
  - Improve act/chapter detection.
  - Add section-level records where possible.
  - Add clickable citations in UI.

  ### Assistant UX

  - Show retrieved source cards.
  - Add "KB did not contain answer" visual state.
  - Add regenerate answer button.
  - Add feedback buttons for helpful/not helpful.

  ### Safety

  - Add automated red-team prompt tests.
  - Add legal-answer regression test set.
  - Add retrieval quality benchmark for known sections.

  ## 19. Final Summary

  The WiseCase RAG chatbot is now a hybrid assistant:

  - **RAG legal assistant** for indexed Pakistani legal materials.
  - **WiseCase platform assistant** for authenticated and public app workflows.

  It uses:

  - **Pinecone** for legal knowledge retrieval and integrated embeddings.
  - **Groq** for streamed LLM responses.
  - **Supabase** for auth, user data, chat history, documents, cases, appointments, reviews, and platform tools.
  - **Next.js API routes** for server-side orchestration.
  - **React/Tailwind UI** for the floating assistant experience.

  The strongest design principle is:

  ```text
  Do not invent legal answers. Use the KB, cite the KB, or say the KB does not contain the answer yet.
  ```

