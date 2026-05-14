# WiseCase Codebase Index

Last indexed: 2026-05-14

This is the working navigation map for the WiseCase FYP codebase. It is based on local source inspection, the executed Supabase SQL history in `scripts/`, and a production build check.

## 1) Stack and Build

- Framework: Next.js 14 App Router, React 18, TypeScript.
- Backend/data: Supabase Auth, Postgres, RLS, Storage, Realtime.
- Payments: Stripe Checkout plus older Payment Intent route.
- AI: Vercel AI SDK, Groq, `groq-sdk`.
- Document extraction: `pdf-parse-fork`; image files are sent to Groq vision model.
- Styling/UI: Tailwind CSS 4, Radix UI, lucide-react.

Build command checked:

- `npm run build`: passes.
- Important caveat: `next.config.mjs` has `eslint.ignoreDuringBuilds = true` and `typescript.ignoreBuildErrors = true`, so the build does not prove lint or type correctness.

## 2) Repository Map

- `app/`: Next.js pages, layouts, API routes, sitemap/robots.
- `components/`: feature components and shared UI primitives.
- `lib/`: Supabase clients, business logic, AI, notifications, Stripe, lifecycle helpers.
- `hooks/`: toast and unread-message hooks.
- `data/`: static app data.
- `scripts/`: Supabase SQL editor execution history. Treat this as the DB migration source of truth unless live DB introspection proves otherwise.
- `supabase/`: local Supabase config.
- `public/`: images and static assets.
- `rag-chatbot-export/rag-chatbot-export/`: separate exported chatbot/Payload/Pinecone project, not wired as the main app runtime.

## 3) Runtime Entrypoints

Core app:

- Root layout: `app/layout.tsx`
- Home: `app/page.tsx`
- Middleware: `middleware.ts`, `lib/supabase/middleware.ts`
- Supabase browser client: `lib/supabase/client.ts`
- Supabase server client: `lib/supabase/server.ts`
- Supabase service-role client: `lib/supabase/admin.ts`

Auth pages/routes:

- Client sign in/register: `app/auth/client/*`
- Lawyer sign in/register: `app/auth/lawyer/*`
- Admin sign in: `app/auth/admin/sign-in/page.tsx`
- Callback: `app/auth/callback/route.ts`
- Reset/forgot password: `app/auth/reset-password`, `app/auth/forgot-password`

Dashboards:

- Client: `app/client/dashboard/page.tsx`
- Lawyer: `app/lawyer/dashboard/page.tsx`
- Admin: `app/admin/dashboard/page.tsx`

## 4) Environment Variables

Required or actively referenced:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `GROQ_API_KEY`
- `RESEND_API_KEY`
- `CRON_SECRET`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL`
- `SUPPORT_EMAIL`

Note:

- Test-connection page moved to `app/admin/test-connection/page.tsx` (admin-only, middleware-protected).

## 5) Supabase SQL Timeline

Base schema:

- `001_create_profiles.sql`: `profiles`, user role check initially `client | lawyer`, profile RLS.
- `002_create_lawyer_profiles.sql`: `lawyer_profiles`, public/own RLS.
- `003_create_cases.sql`: `cases`, initial statuses `open | in_progress | completed | closed`.
- `004_create_appointments.sql`: `appointments`, initial statuses `scheduled | completed | cancelled | rescheduled`.
- `005_create_documents.sql`: `documents`.
- `006_create_document_analysis.sql`: `document_analysis`.
- `007_create_payments.sql`: `payments`.
- `008_create_reviews.sql`: `reviews`.
- `009_create_messages.sql`: `messages`.
- `010_create_triggers.sql`: auth user insert trigger creates `profiles`.

Early expansion:

- `011_add_certifications_table.sql`: lawyer certifications.
- `012_add_profile_fields.sql`: profile/avatar/availability/response fields.
- `013_seed_test_data.sql`: test seed data.
- `014_auto_create_lawyer_profile.sql`: trigger creates `lawyer_profiles` for lawyers.
- `015_add_certifications_public_policy.sql`: public certifications policy.
- `016_add_appointment_request_status.sql`: appointment request lifecycle columns/statuses.
- `017` is missing.
- `018_create_storage_bucket.sql`: `avatars` bucket and policies.
- `019_create_notifications.sql`: notifications table.
- `020_extend_notifications_types.sql`: adds `system` and `payment_update`.
- `021_add_awaiting_payment_status.sql`: appointment `awaiting_payment`, `payments.appointment_id`.
- `022_fix_notifications_is_read_policy.sql`: notification update policy.
- `023_create_documents_storage.sql`: `documents` bucket.
- `024_fix_document_analysis_rls.sql`: insert/update/select policies for analysis.
- `025_optional_notifications_realtime.sql`: optional realtime setup.
- `026_profiles_case_counterparty_access.sql`: profile visibility for case/appointment counterparties.
- `027_create_ai_chat_messages.sql`: assistant history table.
- `028_create_case_studies.sql`: lawyer portfolio cases.
- `029_add_pending_completion_status.sql`: `cases.pending_completion`.
- `030_add_admin_role.sql`: adds `admin` role.
- `031_fix_profiles_recursion.sql`: `is_admin()` and admin RLS without recursion.
- `032_create_portfolio_storage.sql`: `case-studies` and `verifications` buckets, verification fields.
- `033_create_disputes.sql`: `case_disputes`, `handle_updated_at()`, overloaded `is_admin(user_id uuid)`.

AI/document/schema consolidation:

- `034_add_analysis_legal_fields.sql`: extra legal-analysis fields.
- `035_fix_analysis_history_fields.sql`: analysis history fields.
- `036_consolidated_analysis_updates.sql`: consolidated analysis fields.
- `037_add_is_legal_flag.sql`: `document_analysis.is_legal_document`.
- `037_add_lawyer_verification_status.sql`: duplicate number, adds lawyer verification status fields.
- `038_add_ai_license_match.sql`: license match fields.

Case/appointment lifecycle:

- `039_case_completion_workflow.sql`: completion metadata, pending-completion trigger, case-completed appointment sync.
- `040_cases_private_notes.sql`: private lawyer notes on cases.
- `041_fix_appointments_completed_while_case_active.sql`: legacy repair helper.
- `042_appointments_attended_status.sql`: adds `attended`, defines `completed` as closed-with-case.
- `043_phase1_case_centric_foundation.sql`: `case_drafts`, `case_timeline_events`, `ai_security_logs`, analysis metadata, trust fields, Stripe Checkout session id.
- `044_appointments_status_transition_guard.sql`: DB status transition guard.
- `045_document_analysis_jobs.sql`: async analysis job queue.
- `046_ai_chat_messages_case_scope.sql`: `ai_chat_messages.case_id`.
- `047_require_attended_before_case_completion.sql`: requires attended/completed appointment before case completion.
- `048_auto_recompute_lawyer_rating.sql`: DB trigger recomputes lawyer rating.
- `049_make_documents_case_id_nullable.sql`: standalone analysis documents.
- `050_add_reschedule_count.sql`: `reschedule_count`, `previous_status`, `cancellation_requested`.

Seed/utility:

- `seed_dummy_lawyers.sql`

## 6) Current Backend Tables

Identity/profile:

- `profiles`
- `lawyer_profiles`
- `certifications`

Cases and operations:

- `cases`
- `case_drafts`
- `case_timeline_events`
- `case_disputes`
- `appointments`
- `messages`
- `reviews`
- `payments`
- `notifications`

Documents and AI:

- `documents`
- `document_analysis`
- `document_analysis_jobs`
- `ai_chat_messages`
- `ai_security_logs`
- `case_studies`

Storage buckets:

- `avatars`
- `documents`
- `case-studies`
- `verifications`

## 7) Final Status Models

Case status:

- `open`
- `in_progress`
- `pending_completion`
- `completed`
- `closed`

Appointment status:

- `pending`
- `awaiting_payment`
- `scheduled`
- `attended`
- `completed`
- `cancelled`
- `rescheduled`
- `rejected`
- `cancellation_requested`

Important semantics:

- `attended` means the consultation happened and can be billed.
- `completed` on appointments means the appointment was closed because the case was completed.
- `pending_completion` on cases is the lawyer/client completion request handshake.
- `completed` case must come from `pending_completion` due to script `047`.
- `cancellation_requested` is an admin-reviewed paid-appointment cancellation state.

## 8) Major App Flows

Client document analysis:

- UI: `app/client/analysis/page.tsx`, `components/documents/upload-zone.tsx`, `components/documents/analysis-results-view.tsx`
- API: `app/api/analyze-document/route.ts`
- Worker/cron: `app/api/cron/process-analysis-jobs/route.ts`, `lib/analysis/process-analysis-job.ts`
- Core AI: `lib/analysis/run-document-analysis.ts`
- Draft bridge to booking: `lib/case-drafts.ts`

Booking and appointments:

- Booking modal: `components/lawyer/book-appointment-modal.tsx`
- Lawyer requests list: `components/lawyer/client-requests.tsx`
- Client appointments: `app/client/appointments/page.tsx`
- Lawyer appointments: `app/lawyer/appointments/page.tsx`
- APIs: `app/api/appointments/cancel`, `reschedule`, `mark-attended`, `support-ticket`
- Shared semantics: `lib/appointments-status.ts`, `lib/appointment-display.ts`

Case workspace:

- Client cases list/detail: `app/client/cases/page.tsx`, `app/client/cases/[id]/page.tsx`
- Lawyer cases list/detail: `app/lawyer/cases/page.tsx`, `app/lawyer/cases/[id]/page.tsx`
- Lifecycle UI: `lib/case-lifecycle-stages.ts`, `components/cases/case-progress-stepper.tsx`
- Timeline: `lib/case-timeline.ts`, `components/cases/case-activity-feed.tsx`
- Disputes: `lib/case-disputes.ts`, `components/cases/dispute-modal.tsx`, `app/admin/disputes/page.tsx`

Payments:

- Client payment UI: `components/payments/*`, `app/client/payments/page.tsx`, `app/client/appointments/page.tsx`
- Checkout: `app/api/stripe/create-checkout-session/route.ts`
- Legacy Payment Intent: `app/api/stripe/create-payment-intent/route.ts`
- Verification after redirect: `app/api/stripe/verify-payment/route.ts`
- Webhook: `app/api/stripe/webhook/route.ts`
- Stripe config: `lib/stripe/config.ts`

Notifications/email:

- In-app helper: `lib/notifications.ts`
- Bell/listener: `components/notifications/*`
- Email API: `app/api/notify/email/route.ts`
- Email helper: `lib/email.ts`

Chatbot:

- UI: `components/chatbot/Chat.tsx`, `components/chatbot/chatbot.tsx`
- API: `app/api/chat/route.ts`
- History API: `app/api/chat/history/route.ts`
- Case context: `lib/chat-case-context.ts`
- Route normalization: `lib/chat-routes.ts`
- Tools: `lib/ai/tools.ts`
- Chat data/prompt: `lib/chatBotData.ts`

Lawyer verification/profile:

- Lawyer register: `app/auth/lawyer/register/page.tsx`
- Lawyer layout verification prompt: `app/lawyer/layout.tsx`
- Lawyer profile: `app/lawyer/profile/page.tsx`
- Admin verification: `app/admin/lawyers/page.tsx`
- License verify API: `app/api/lawyer/verify-license/route.ts`

## 9) Current Risk Status

### Fixed (Codex pass, 2026-05-14)

1. ~~Stripe webhook used cookie-based `createClient()`.~~
   - **Fixed**: `app/api/stripe/webhook/route.ts` now uses `createAdminClient()` from `lib/supabase/admin.ts`.

2. ~~Notification inserts in Stripe routes missing `created_by`.~~
   - **Fixed**: All 4 notification inserts (2 in webhook, 2 in verify-payment) now include `created_by`.

3. ~~`mark-attended` JSDoc said 30 minutes, code allowed 7 days.~~
   - **Fixed**: JSDoc comment updated to reflect the intentional 7-day early check-in window. Behavior unchanged.

4. ~~Image detection used `.jgp` instead of `.jpg`.~~
   - **Fixed**: `lib/analysis/run-document-analysis.ts` now checks `.jpg`, `.jpeg`, `.png` with correct MIME mapping.

5. ~~`/test-connection` page was publicly accessible.~~
   - **Fixed**: Moved to `app/admin/test-connection/page.tsx`. Old `app/test-connection/page.tsx` deleted. Middleware enforces admin-only access.

### Remaining Notes

1. Build skips type and lint validation.
   - File: `next.config.mjs` has `eslint.ignoreDuringBuilds = true` and `typescript.ignoreBuildErrors = true`.
   - Intentionally deferred — not changed in this pass.

2. `verify-payment` route uses user-scoped Supabase client.
   - File: `app/api/stripe/verify-payment/route.ts` still uses `createClient()` (cookie-based).
   - This is acceptable because verify-payment is called by authenticated users after redirect, not by Stripe.
   - The webhook (`createAdminClient()`) is the reliable payment writer; verify-payment is an idempotent fallback.

3. Production must have `SUPABASE_SERVICE_ROLE_KEY` set.
   - Required for `createAdminClient()` in webhook, email API, document delete, message mark-read, and admin cancellation paths.

4. Encoding/mojibake exists in many comments/log strings.
   - Examples: `â€”`, `âœ`, `â†`, `â€¢`.
   - Mostly cosmetic, but user-facing text also includes this in several pages/components.

7. SQL numbering and consolidation are imperfect.
   - Missing `017`.
   - Two different `037` scripts.
   - `034` and `035` overlap with `036`.
   - Future migration work should preserve execution order carefully.

## 10) Known Improved/Fresh Areas

Recent modified worktree already contains changes around:

- cancellation requests
- reschedule count
- support-ticket cancellation flow
- appointment status UI
- payment verification/checkouts
- case timeline event types
- email helper

Modified files at index time:

- `app/admin/cancellation-requests/page.tsx`
- `app/api/appointments/reschedule/route.ts`
- `app/api/appointments/support-ticket/route.ts`
- `app/api/notify/email/route.ts`
- `app/api/stripe/create-checkout-session/route.ts`
- `app/api/stripe/verify-payment/route.ts`
- `app/api/stripe/webhook/route.ts`
- `app/client/appointments/page.tsx`
- `app/client/cases/[id]/page.tsx`
- `app/client/cases/page.tsx`
- `app/client/dashboard/page.tsx`
- `app/lawyer/appointments/page.tsx`
- `app/lawyer/cases/[id]/page.tsx`
- `components/lawyer/availability-calendar.tsx`
- `components/lawyer/book-appointment-modal.tsx`
- `components/lawyer/client-requests.tsx`
- `components/lawyer/upcoming-appointments.tsx`
- `lib/case-timeline.ts`
- `lib/email.ts`
- `scripts/050_add_reschedule_count.sql`

These were present before this index refresh and should be treated as user/current-work changes unless intentionally edited.

## 11) Best Next Fix Order

Items 1–5 completed (Codex pass, 2026-05-14). Remaining:

1. Run a real type check/lint pass after temporarily disabling the `next.config.mjs` ignores or adding separate scripts.
2. Normalize mojibake in user-facing strings.

## 12) Implementation Notes for Future Work

- Prefer `lib/appointments-status.ts` for appointment status semantics instead of hard-coding arrays.
- Use `appendCaseTimelineEvent()` for meaningful lifecycle changes, but expect it to fail gracefully if old DB scripts are missing.
- Use `createNotification()` unless a server route intentionally uses service role and sets `created_by`.
- For server-to-server jobs/webhooks, use `createAdminClient()`.
- For user-facing API routes, use `createClient()` and enforce row ownership before mutating data.
- For case completion, do not bypass the DB lifecycle: lawyer requests `pending_completion`, client confirms `completed`.
- For paid appointment cancellation, use `cancellation_requested` and admin resolution rather than direct cancellation.
- For standalone document analysis, `documents.case_id` may be null after script `049`.
