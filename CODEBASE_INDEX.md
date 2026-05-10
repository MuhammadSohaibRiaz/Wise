# WiseCase Codebase Index

This file is a fast navigation map of the repository, with special focus on Supabase and executed SQL scripts in `scripts/`.

## 1) Repository map

- `app/`: Next.js App Router pages and API route handlers.
- `components/`: feature UI components (`admin`, `auth`, `chat`, `client`, `lawyer`, `payments`, `notifications`, `ui`).
- `lib/`: shared logic and integrations (Supabase clients/middleware, AI tools, Stripe, notifications).
- `hooks/`: reusable React hooks.
- `data/`: static data/constants.
- `scripts/`: SQL files executed in Supabase SQL editor (schema evolution source of truth).
- `public/`, `styles/`: static assets and styling.
- `rag-chatbot-export/rag-chatbot-export/`: separate nested project (Next.js + Payload + Pinecone).

## 2) Main stack

- Frontend/app: Next.js 14, React 18, TypeScript.
- Data/auth/storage: Supabase (`@supabase/ssr`, `@supabase/supabase-js`).
- Payments: Stripe.
- AI: Vercel AI SDK + Groq.
- OCR/PDF: `tesseract.js`, `pdf-parse-fork`.

## 3) Runtime entry points

- App layout: `app/layout.tsx`
- Home page: `app/page.tsx`
- Middleware: `middleware.ts` and `lib/supabase/middleware.ts`
- Auth callback: `app/auth/callback/route.ts`
- Key APIs:
  - `app/api/chat/route.ts`
  - `app/api/chat/history/route.ts`
  - `app/api/analyze-document/route.ts`
  - `app/api/stripe/*`

## 4) Supabase SQL timeline (`scripts/`)

Intended execution order (by numeric prefix):

- `001`-`010`: base profile/case/appointment/document/payment/review/message tables + auth trigger.
- `011`-`016`: certifications, profile/lawyer profile field expansions, appointment request statuses.
- `018`-`024`: storage buckets, notifications system, document analysis RLS fix.
- `025`-`033`: realtime optional setup, access policy adjustments, AI chat table, case studies, admin role, recursion/policy fixes, disputes.
- `034`-`036`: document analysis legal/history field updates (with consolidation in `036`).
- `037`: explicit lawyer verification workflow state (`pending`/`approved`/`rejected`).
- Extra utility seed: `scripts/seed_dummy_lawyers.sql`.

Note: migration number `017` is missing; `034` + `035` are partially consolidated by `036`.

## 5) Supabase schema index (high-level)

Core identity and people:
- `profiles`
- `lawyer_profiles`
- `certifications`

Case and operations:
- `cases`
- `appointments`
- `messages`
- `reviews`
- `payments`
- `notifications`
- `case_disputes`

Documents and AI:
- `documents`
- `document_analysis`
- `ai_chat_messages`
- `case_studies`

Storage buckets in scripts:
- `avatars`
- `documents`
- `case-studies`
- `verifications`

## 6) Trigger/functions in SQL

- `handle_new_user()` + trigger on `auth.users` (auto-create `profiles`).
- `handle_new_lawyer_profile()` + trigger on `profiles` insert.
- `is_admin()` helper functions for RLS checks.
- `handle_updated_at()` trigger utility (used by disputes).

## 7) High-priority consistency checks already identified

- `components/cases/dispute-modal.tsx` sets `cases.status = "disputed"`, while SQL status constraints allow `open`, `in_progress`, `pending_completion`, `completed`, `closed`.
- Storage/privacy and public-read policies should be reviewed for:
  - `scripts/023_create_documents_storage.sql`
  - `scripts/032_create_portfolio_storage.sql`
  - broad `lawyer_profiles` public select policy.

## 8) App-to-table usage hotspots

- Profiles/lawyer data: `app/lawyer/profile/page.tsx`, `app/match/page.tsx`, `app/admin/lawyers/page.tsx`.
- Cases/appointments/payments: `app/client/dashboard/page.tsx`, `app/client/cases/[id]/page.tsx`, `app/lawyer/cases/[id]/page.tsx`, `app/api/stripe/*`.
- Documents/analysis: `app/client/analysis/page.tsx`, `app/api/analyze-document/route.ts`.
- Messages: `components/chat/messages-shell.tsx`.
- Notifications: `components/notifications/notification-bell.tsx`, `lib/notifications.ts`.
- Disputes: `components/cases/dispute-modal.tsx`, `app/admin/disputes/page.tsx`.
- AI chat history: `app/api/chat/route.ts`, `app/api/chat/history/route.ts`.

---

If this index diverges from production Supabase state, prefer actual DB introspection as canonical, then update this file.
