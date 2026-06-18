# WiseCase Presentation Data

This report extracts exact values from the current workspace files. It is based on the live code and SQL scripts in this repo, not estimates.

## 1. Pages & Routes

### Exact counts

| Item | Count |
|---|---:|
| `app/**/page.tsx` files | 43 |
| `app/api/**/route.ts` files | 33 |

### API routes

| Route | Method(s) | Purpose |
|---|---|---|
| `app/api/admin/cancellation-requests/route.ts` | `GET`, `PATCH` | List actionable cancellation requests and resolve them by approving or rejecting. |
| `app/api/admin/cancellation-requests/count/route.ts` | `GET` | Return actionable cancellation counts for the admin UI. |
| `app/api/admin/cancellation-requests/refund/route.ts` | `POST` | Process a refund for an approved cancellation request. |
| `app/api/admin/lawyers/[id]/license/route.ts` | `GET` | Stream a lawyer license document to an admin. |
| `app/api/analyze-document/route.ts` | `POST` | Create a document analysis job. |
| `app/api/analyze-document/job/[jobId]/route.ts` | `GET` | Poll and lazily process a queued analysis job. |
| `app/api/appointments/cancel/route.ts` | `POST` | Cancel an appointment and notify the other party. |
| `app/api/appointments/mark-attended/route.ts` | `POST` | Mark a consultation as attended. |
| `app/api/appointments/mark-no-show/route.ts` | `POST` | Mark a consultation as no-show. |
| `app/api/appointments/reschedule/route.ts` | `POST` | Reschedule an appointment under the defined business rules. |
| `app/api/appointments/respond/route.ts` | `POST` | Accept or reject an appointment request. |
| `app/api/appointments/support-ticket/route.ts` | `POST` | Submit a cancellation support ticket to support/admins. |
| `app/api/auth/mark-email-verified/route.ts` | `POST` | Mark a profile email as verified. |
| `app/api/auth/send-verification-email/route.ts` | `POST` | Send a verification email to a user. |
| `app/api/cases/[id]/complete/route.ts` | `POST` | Let the client confirm case completion and set the case outcome. |
| `app/api/cases/[id]/summary/route.ts` | `GET` | Generate an AI case summary. |
| `app/api/chat/route.ts` | `POST` | Serve the general WiseCase assistant chat endpoint. |
| `app/api/chat/history/route.ts` | `GET`, `DELETE` | Load or clear AI chat history, optionally scoped to a case. |
| `app/api/cron/process-analysis-jobs/route.ts` | `GET` | Process queued document analysis jobs. |
| `app/api/documents/delete/route.ts` | `POST` | Delete a document and its metadata/storage object. |
| `app/api/documents/rename/route.ts` | `POST` | Rename an uploaded document. |
| `app/api/documents/view/[id]/route.ts` | `GET` | Proxy and stream an authorized document file. |
| `app/api/judge-simulation/route.ts` | `POST` | Run the AI judge simulation. |
| `app/api/lawyer/verify-license/route.ts` | `POST` | Verify a lawyer license upload. |
| `app/api/lawyers/search/route.ts` | `GET` | Search verified lawyers by filters and specialization. |
| `app/api/legal-rag-chat/route.ts` | `POST` | Serve the legal RAG assistant and WiseCase platform assistant. |
| `app/api/messages/attachment/route.ts` | `GET`, `POST` | Upload message attachments or fetch an uploaded attachment. |
| `app/api/messages/mark-read/route.ts` | `POST` | Mark messages as read. |
| `app/api/notify/email/route.ts` | `POST` | Send templated notification emails. |
| `app/api/stripe/create-checkout-session/route.ts` | `POST` | Create a Stripe Checkout session. |
| `app/api/stripe/create-payment-intent/route.ts` | `POST` | Create a Stripe PaymentIntent. |
| `app/api/stripe/verify-payment/route.ts` | `POST` | Verify a checkout session and finalize payment state. |
| `app/api/stripe/webhook/route.ts` | `POST` | Handle Stripe webhook events. |

## 2. Database

### Exact counts

| Item | Count |
|---|---:|
| Tables created in `scripts/*.sql` | 20 |
| SQL migration scripts | 64 |
| SQL files in `scripts/` total | 65 |
| DB indexes | 18 |

### Tables and purpose

| Table | Purpose |
|---|---|
| `profiles` | Core user profile, role, and contact data. |
| `lawyer_profiles` | Lawyer-specific profile data, verification, rates, and credentials. |
| `cases` | Main legal case records and lifecycle state. |
| `appointments` | Consultation booking and lifecycle records. |
| `reviews` | Client reviews for lawyers. |
| `payments` | Payment records linked to appointments and cases. |
| `documents` | Uploaded case documents and file metadata. |
| `document_analysis` | Stored AI analysis results for documents. |
| `messages` | Case chat messages between client and lawyer. |
| `certifications` | Lawyer certifications and public credential data. |
| `notifications` | In-app notifications for users. |
| `ai_chat_messages` | Persisted AI assistant chat history. |
| `case_studies` | Lawyer portfolio / case study content. |
| `case_drafts` | Draft case intake records and linked documents. |
| `case_timeline_events` | Timeline/audit events for a case. |
| `ai_security_logs` | Security scan logs for document analysis. |
| `case_disputes` | Dispute records raised for cases. |
| `document_analysis_jobs` | Async analysis job queue. |
| `case_document_notes` | Private notes on case documents. |
| `case_document_comments` | Comments attached to case documents. |

### Triggers and what they enforce

| Trigger | Table | Enforcement |
|---|---|---|
| `on_auth_user_created` | `auth.users` | Automatically creates a profile row for a new auth user. |
| `on_profile_created_lawyer` | `profiles` | Automatically creates a `lawyer_profiles` row when a lawyer profile is inserted. |
| `handle_disputes_updated_at` | `case_disputes` | Keeps `updated_at` current on dispute edits. |
| `cases_stamp_completion_request` | `cases` | Stamps and clears completion-request metadata as case status changes. |
| `cases_sync_appointments_on_completed` | `cases` | Marks related appointments completed when a case is completed. |
| `trg_case_drafts_updated_at` | `case_drafts` | Keeps `updated_at` current on draft edits. |
| `appointments_status_transition_guard` | `appointments` | Blocks invalid appointment status transitions. |
| `cases_require_attended_before_completion` | `cases` | Requires at least one attended consultation before completion flow. |
| `trg_recompute_lawyer_rating` | `reviews` | Recomputes lawyer rating after review changes. |
| `cases_status_transition_guard` | `cases` | Enforces valid case transitions and terminal-state rules. |
| `trg_cases_recompute_lawyer_success` | `cases` | Recomputes lawyer success rate when a case completes. |

### Indexes

| Index | Table | Columns |
|---|---|---|
| `idx_certifications_lawyer_id` | `certifications` | `lawyer_id` |
| `idx_notifications_user_id` | `notifications` | `user_id` |
| `idx_notifications_created_at` | `notifications` | `created_at DESC` |
| `idx_payments_appointment_id` | `payments` | `appointment_id` |
| `ai_chat_messages_user_id_idx` | `ai_chat_messages` | `user_id` |
| `ai_chat_messages_created_at_idx` | `ai_chat_messages` | `created_at` |
| `case_drafts_client_id_idx` | `case_drafts` | `client_id` |
| `case_drafts_document_idx` | `case_drafts` | `linked_document_id` |
| `case_drafts_client_document_uidx` | `case_drafts` | `client_id, linked_document_id` |
| `case_timeline_case_id_idx` | `case_timeline_events` | `case_id, created_at DESC` |
| `ai_security_logs_doc_idx` | `ai_security_logs` | `document_id` |
| `ai_security_logs_created_idx` | `ai_security_logs` | `created_at DESC` |
| `idx_payments_stripe_checkout_session` | `payments` | `stripe_checkout_session_id` |
| `document_analysis_jobs_doc_idx` | `document_analysis_jobs` | `document_id` |
| `document_analysis_jobs_status_idx` | `document_analysis_jobs` | `status, created_at` |
| `ai_chat_messages_user_case_created_idx` | `ai_chat_messages` | `user_id, case_id, created_at` |
| `case_document_notes_document_idx` | `case_document_notes` | `document_id` |
| `case_document_comments_document_created_idx` | `case_document_comments` | `document_id, created_at DESC` |

### RLS-enabled tables

| Table |
|---|
| `profiles` |
| `lawyer_profiles` |
| `cases` |
| `appointments` |
| `reviews` |
| `payments` |
| `documents` |
| `document_analysis` |
| `messages` |
| `certifications` |
| `notifications` |
| `ai_chat_messages` |
| `case_studies` |
| `case_drafts` |
| `case_timeline_events` |
| `ai_security_logs` |
| `case_disputes` |
| `document_analysis_jobs` |
| `case_document_notes` |
| `case_document_comments` |

## 3. Components & Code

| Item | Count |
|---|---:|
| Files under `components/` | 74 |
| Files under `lib/` | 68 |
| `.ts` + `.tsx` files in repo | 245 |
| Approximate lines of code | 38,753 |

## 4. AI / RAG

### Exact core config

| Setting | Value |
|---|---|
| Pinecone index name | `wisecase-legal-rag` |
| Pinecone namespace | `pakistan-legal-kb` |
| Embed model | `llama-text-embed-v2` |
| Groq assistant model default | `llama-3.3-70b-versatile` |
| TopK | `8` |
| Minimum retrieval score gate | `0.35` |
| Low-confidence note threshold | `0.42` |
| Current legal source files | 14 |
| Current total chunks | 1,891 |

### Groq models used in code

| Model |
|---|
| `llama-3.3-70b-versatile` |
| `meta-llama/llama-4-scout-17b-16e-instruct` |

### Legal source files and corpus folders

| Corpus folder | File |
|---|---|
| `civil` | `code of civil procedure 1908.md` |
| `civil` | `Contract Act, 1872.md` |
| `criminal` | `Code of Criminal Procedure, 1898.md` |
| `criminal` | `Pakistan Penal Code.md` |
| `criminal` | `Qanun-e-Shahadat Order, 1984.md` |
| `family` | `Dissolution of Muslim Marriages Act, 1939.md` |
| `family` | `Muslim Family Laws Ordinance, 1961.md` |
| `family` | `West Pakistan Family Courts Act, 1964.md` |
| `immigration` | `Emigration Rules, 1979 updated 2023.md` |
| `labour` | `Industrial Relations Act, 2012.md` |
| `property` | `Registration Act, 1908.md` |
| `property` | `Transfer of Property Act, 1882.md` |
| `tax` | `Income Tax Ordinance, 2001.md` |
| `tax` | `Sales Tax Act, 1990.md` |

### Query classification categories

These are the top-level classifier outcomes in `app/api/legal-rag-chat/route.ts` and the exact trigger patterns used to reach them.

| Category | Exact trigger patterns |
|---|---|
| `greeting` | `^(hi|hii|hello|helo|hlo|hey|yo|salam|assalamualaikum|assalamu alaikum|aoa|good\s+(morning|afternoon|evening))[\s!.,?]*$` |
| `capability` | `^(what can you do|who are you|what are you|help|how can you help|what is this|what can i ask)[\s!.,?]*$` |
| `refuse: jailbreak` | `\b(ignore|forget|override|bypass|disable|avoid)\b.*\b(instruction|instructions|system|developer|policy|rule|guardrail|safety)\b`; `\b(system prompt|developer message|hidden prompt|internal instructions|reveal your prompt|print your prompt)\b`; `\b(jailbreak|dan mode|do anything now|roleplay as unrestricted|pretend you are not)\b`; `\b(answer without context|do not use retrieval|ignore retrieved context|make up|hallucinate)\b`; `\b(exfiltrate|leak|show secrets|api key|environment variables|pinecone key|groq key)\b` |
| `platform` | Urdu platform-intent regexes in `hasUrduPlatformIntent`; platform keyword patterns in `platformPatterns`; platform terms list in `platformTerms`; and `isClearPlatformAccountIntent` regexes such as profile completion, phone/bio updates, recent cases/appointments, lawyer search, fees/refund/privacy, review/rating requests, and profile-check phrasing. |
| `retrieve` | `isPakistaniLegalStatuteQuestion` regexes; `hasUrduLegalIntent` regex; `legalDomainPattern` combined with `personalScenarioPattern` or `guidancePattern`; `legalScenarioPatterns`; and the contextual follow-up gate `hasRecentLegalContext && isContextualFollowUp(query)`. |
| `refuse: privateData` | `\b(supabase|database|table|row|record|auth session|cookie)\b`; `\b(show|reveal|list|dump|export)\b.*\b(email|phone|cnic|payment|card|secret|api key|environment variable)\b` |
| `refuse: nonPakistan` | `\b(india|indian|usa|united states|uk|britain|canada|australia|uae|dubai|saudi|international law|american law|english law)\b` when not paired with `pakistan|pakistani|ppc|penal code`. |
| `refuse: irrelevant` | `clearlyIrrelevantTerms` list: `recipe`, `movie`, `song`, `poem`, `weather`, `stock`, `crypto`, `football`, `cricket score`, `javascript`, `python`, `sql query`, `write code`, `debug code`, `marketing`, `essay`, `love letter`, `travel plan`, `diet plan`, `workout`. |
| `refuse: tooVague` | Query length `< 4`, or a non-matching query that does not satisfy the legal relevance check `legalTerms.some(...) || /\b\d{2,3}[a-z]?\b/`. |

## 5. Security

| Item | Value |
|---|---|
| Regex detection patterns in `lib/document-analysis-security.ts` | 34 |
| Attack categories | `instruction_override`, `system_prompt_extract`, `role_play_attack`, `config_extract`, `fake_urgency`, `result_manipulation`, `code_injection_text`, `prompt_stuffing` |

### Rate limiting values

| Route / feature | Limit |
|---|---|
| `app/api/legal-rag-chat/route.ts` | `30` requests/minute for authenticated users; `8` requests/minute for guests |
| `app/api/analyze-document/job/[jobId]/route.ts` | `90` requests/minute |
| `app/api/auth/send-verification-email/route.ts` | `3` requests per `60_000` ms per email |

## 6. Email

### Email templates in `app/api/notify/email/route.ts`

| Template |
|---|
| `case_completion_request` |
| `appointment_requested` |
| `appointment_accepted` |
| `appointment_rejected` |
| `payment_confirmed` |
| `verification_approved` |
| `verification_rejected` |
| `appointment_rescheduled` |
| `appointment_cancelled` |
| `appointment_cancellation_resolved` |
| `appointment_cancellation_refunded` |

### Provider and from address

| Item | Value |
|---|---|
| Email provider | `Resend` |
| From address default | `WiseCase <noreply@rapidnextech.com>` |

## 7. Payments

| Item | Value |
|---|---|
| Stripe integration type | Both `Checkout` and `PaymentIntent` are used |
| Currency | `PKR` (`APP_CURRENCY`), code `pkr` for Stripe requests |
| Webhook events handled | `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed` |

## 8. Real-Time

### Direct realtime subscribers in pages/components/hooks

| File | Subscribed tables |
|---|---|
| `app/client/dashboard/page.tsx` | `notifications`, `cases`, `appointments`, `payments` |
| `app/client/cases/page.tsx` | `cases`, `appointments`, `payments` |
| `app/client/appointments/page.tsx` | `appointments`, `payments`, `notifications`, `cases` |
| `app/client/payments/page.tsx` | `payments`, `appointments` |
| `app/lawyer/cases/page.tsx` | `cases` |
| `app/lawyer/appointments/page.tsx` | `appointments`, `cases`, `notifications` |
| `components/lawyer/verification-notice.tsx` | `lawyer_profiles` |
| `components/lawyer/profile-completion-card.tsx` | `profiles`, `lawyer_profiles` |
| `components/lawyer/client-requests.tsx` | `appointments` |
| `components/notifications/message-badge.tsx` | `messages` |
| `components/notifications/notification-bell.tsx` | `notifications` |
| `components/notifications/notification-toast-listener.tsx` | `notifications` |
| `hooks/use-unread-messages.ts` | `messages` |
| `lib/hooks/use-case-detail-realtime-sync.ts` | `cases`, `appointments`, `case_timeline_events`, `documents` |
| `lib/hooks/use-admin-cancellation-sync.ts` | `appointments`, `payments` |

### Pages/components that use the realtime cancellation hook

| File | Notes |
|---|---|
| `components/admin/admin-header.tsx` | Uses `useAdminCancellationSync` to refresh cancellation counts. |
| `app/admin/cancellation-requests/page.tsx` | Uses `useAdminCancellationSync` for live queue updates. |

## 9. Appointment & Case

### Case status values

| Values |
|---|
| `open` |
| `in_progress` |
| `pending_completion` |
| `completed` |
| `closed` |

### Appointment status values

| Values |
|---|
| `pending` |
| `awaiting_payment` |
| `scheduled` |
| `attended` |
| `completed` |
| `cancelled` |
| `rescheduled` |
| `rejected` |
| `cancellation_requested` |

### Rescheduling business rules

| Rule | Exact value |
|---|---|
| Appointment must be reschedulable only when status is | `scheduled` or `rescheduled` |
| Cannot reschedule within | `2 hours` of the appointment start |
| New time must be at least | `24 hours` from now |
| New time must be within | `60 days` from now |
| Maximum reschedules | `3` |
| Slot buffer minimum | `60 minutes` |
| Reschedule UI label limit | Hides reschedule action after `3` reschedules |

### Case outcome values

| Values |
|---|
| `won` |
| `lost` |
| `settled` |
| `ongoing` |

## 10. Environment Variables

Names only, with no values:

`ASSISTANT_MODEL`, `ASSISTANT_TEMPERATURE`, `CRON_SECRET`, `GROQ_API_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NODE_ENV`, `PINECONE_API_KEY`, `PINECONE_CLOUD`, `PINECONE_EMBED_MODEL`, `PINECONE_INDEX`, `PINECONE_NAMESPACE`, `PINECONE_REGION`, `RAG_ASSISTANT_MAX_OUTPUT_TOKENS`, `RAG_ASSISTANT_MODEL`, `RAG_ASSISTANT_TEMPERATURE`, `RAG_ASSISTANT_TOPK`, `RAG_CORPORA`, `RAG_RECREATE_INDEX`, `RAG_RESET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPPORT_EMAIL`, `VERCEL_ENV`, `VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_URL`

## 11. Deployment

| Item | Value |
|---|---|
| Deployment target | Vercel is the implied deployment platform (`vercel.json` exists; repo uses `VERCEL_*` environment variables). |
| Package manager | `pnpm@9.15.9` |
| Node.js version | Not pinned in the repo; no `.nvmrc`, `.node-version`, or `engines.node` field is present. |
| Next.js version | `^14.2.35` |

## 12. Features List

### Client features

- Client sign-in, registration, password reset, and auth callback flow.
- Client dashboard with live updates.
- Lawyer search and matching.
- View lawyer profiles and reviews.
- Book, accept, reschedule, or cancel appointments.
- Submit appointment support tickets for cancellation review.
- View case list and case details.
- Confirm case completion and provide case outcome.
- Upload, rename, delete, and view case documents.
- Run document analysis and view AI results.
- Use the legal RAG assistant and general WiseCase assistant.
- Send and receive messages with attachments.
- View payment status and complete payments.
- Receive notifications and mark them as read.
- Update profile and account settings.
- Use judge simulation and AI recommendations screens.

### Lawyer features

- Lawyer sign-in and registration.
- Lawyer dashboard and profile management.
- Lawyer verification / license upload and approval flow.
- Availability, appointments, and consultation management.
- View client requests and case lists.
- Receive cancellation and reschedule notifications.
- Reply to messages and manage chat conversations.
- Review case details and progress.
- Build and complete professional profile fields.
- Manage portfolio/case-study related content.
- View reviews and profile completion status.

### Admin features

- Admin dashboard.
- Admin users and lawyer management screens.
- Review lawyer license documents.
- Review and resolve cancellation requests.
- Process refunds for eligible cancellations.
- View security logs.
- View disputes.
- Manage cancellation counts and queue status.
- Access test connection and admin diagnostics pages.
- Receive live cancellation queue updates.
