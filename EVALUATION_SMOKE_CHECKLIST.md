# WiseCase — Evaluation Smoke Checklist (10–15 minutes)

Use this checklist before the re-evaluation. Each step is designed to catch demo-breaking issues fast.

## A) One-time prerequisites (Supabase)

- Run SQL migrations (in order) up to `scripts/037_add_lawyer_verification_status.sql`.
- Ensure Supabase Realtime publication includes:
  - `public.notifications` (see `scripts/025_optional_notifications_realtime.sql`)
  - `public.messages` (if you want realtime chat insert/update events)

## B) Accounts and roles (3 minutes)

- Client account:
  - Register with a strong password (8+ chars, upper+lower+number).
  - Sign in successfully.
- Lawyer account:
  - Register with strong password + select specialization + attach license.
  - Confirm that the success message indicates pending verification (only if upload succeeded).
  - If email confirmation is required and upload fails, confirm the UI instructs the lawyer to upload from `/lawyer/profile`.
- Admin account:
  - Sign in and open `/admin/lawyers`.

## C) Lawyer verification workflow (2 minutes)

- Admin:
  - Approve a pending lawyer → lawyer receives a realtime notification.
  - Reject a pending lawyer → lawyer receives a realtime notification and sees “Verification Rejected”.
- Lawyer:
  - Click “Re-upload Document” → goes to `/lawyer/profile?tab=professional&focus=license`.
  - Upload a new license and click “Save Changes” → verification resets to pending.
- Admin:
  - Confirm the lawyer re-appears in pending list (no “No Doc” for newly submitted verification).

## D) Chatbot scope & navigation validation (2 minutes)

- Ask: “I’m looking for a heart surgeon”
  - Expected: assistant refuses (legal-only scope), does NOT provide medical info, and does NOT show “Find a doctor”.
- Ask a legal query (Pakistan context)
  - Expected: assistant answers within Pakistani law framing.
- Ask: “Take me to appointments”
  - Expected: navigation is role-correct (`/client/appointments` or `/lawyer/appointments`).

## E) Chatbot history persistence (1 minute)

- Send: “Hello” → refresh → confirm BOTH your message and assistant message are present (not assistant-only).

## F) Booking & payment UX (3 minutes)

- Open a lawyer profile with hourly rate = 0:
  - Try booking → expected: clean toast error (“rate not set”), no red runtime overlay.
- For a lawyer with hourly rate set:
  - Book appointment → lawyer sees request → lawyer accepts → client sees `awaiting_payment`.
  - Complete payment → appointment becomes `scheduled` and notifications fire.

## G) Case completion workflow (2 minutes)

- On a case that is `in_progress`:
  - Lawyer clicks “Request Completion” (banner on `/lawyer/cases/[id]`) → client gets notification and case becomes `pending_completion`.
  - Client confirms completion → case becomes `completed` and lawyer receives a completion notification.

## H) What to show in code (for evaluator)

- AI scope + guardrails prompt:
  - `lib/chatBotData.ts`
  - `app/api/analyze-document/route.ts`
- Chat history save (user + assistant):
  - `app/api/chat/route.ts` (onFinish save logic)
  - `app/api/chat/history/route.ts`
- Realtime notifications:
  - `components/notifications/notification-toast-listener.tsx`
  - `components/notifications/notification-bell.tsx`
  - `scripts/025_optional_notifications_realtime.sql`
- RLS + triggers:
  - `scripts/019_create_notifications.sql`
  - `scripts/010_create_triggers.sql`
  - `scripts/014_auto_create_lawyer_profile.sql`
  - `scripts/031_fix_profiles_recursion.sql`

## I) Phase 5 final checks (2–3 minutes)

- Async analysis queue:
  - Upload from `/client/analysis` or chatbot upload.
  - Confirm response is queued (`jobId`) and eventually resolves to completed.
- Chat thread controls:
  - On a case page (`/client/cases/[id]` or `/lawyer/cases/[id]`), open assistant.
  - Confirm history is case-scoped, “Load older messages” works, and “Clear thread” clears only that case thread.
- Abuse guard behavior:
  - Rapidly spam chat send or job-poll requests.
  - Confirm API returns `429` with `Retry-After` rather than failing with generic `500`.
