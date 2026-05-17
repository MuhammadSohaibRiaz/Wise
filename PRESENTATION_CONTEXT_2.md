# WiseCase Presentation Context 2

Generated from the current codebase on 2026-05-18.

This document records real behavior from the codebase, SQL scripts, middleware, and components. It is intentionally honest about limitations.

## 1. User Roles and Exact Permissions

Role enforcement is split across:

- `middleware.ts` and `lib/supabase/middleware.ts`
- Supabase RLS policies in `scripts/*.sql`
- client-side route layouts/components
- API route authorization checks
- database triggers for lifecycle consistency

### Public / Guest Access

Public routes from middleware:

- `/`
- `/auth/*`
- `/match`
- `/terms`
- `/privacy`
- `/client/lawyer/*`
- `/api/chat`
- `/api/legal-rag-chat`

Guest capabilities:

- View landing page.
- View auth pages.
- Browse `/match`.
- View public lawyer profile route prefix `/client/lawyer/*`.
- Use `/api/chat` in guest mode without private tools.
- Use `/api/legal-rag-chat` for public legal KB questions and public platform tools.

Guest restrictions:

- Cannot access `/client/*` except `/client/lawyer/*`.
- Cannot access `/lawyer/*`.
- Cannot access `/admin/*`.
- Cannot access private cases, appointments, documents, payments, messages, persisted chat history, or profile updates.

### Client Role

Exact pages under client area:

- `/client/dashboard`
- `/client/cases`
- `/client/cases/[id]`
- `/client/appointments`
- `/client/analysis`
- `/client/ai-recommendations`
- `/client/documents`
- `/client/judge-simulation`
- `/client/lawyer/[id]`
- `/client/messages`
- `/client/payments`
- `/client/profile`
- `/client/reviews`
- `/client/settings`

Other accessible pages:

- public pages listed above
- `/match`

Exact actions clients can perform:

- Register and sign in through client auth pages.
- View own dashboard metrics.
- Browse and search lawyers.
- View public lawyer profiles.
- Upload documents for standalone AI case analysis.
- View own document analysis history.
- Delete own analysis documents through `/api/documents/delete`.
- Book consultation requests with lawyers.
- View own cases.
- View case detail only when `cases.client_id = auth user`.
- View shared case documents for own cases.
- Upload raw case documents from the Documents tab while case status is not `completed` or `closed`.
- Add private notes only on documents they uploaded.
- Comment on documents uploaded by the lawyer in the same case.
- View own appointments.
- Pay for accepted appointments.
- Reschedule eligible scheduled/rescheduled appointments.
- Cancel unpaid appointment requests in `pending` or `awaiting_payment`.
- Submit support/admin cancellation request for paid appointments in `scheduled` or `rescheduled`.
- Mark consultations as held through `/api/appointments/mark-attended` if participant and within the time rule.
- Confirm case completion when case is `pending_completion`.
- Decline completion request, moving case back to `in_progress`.
- Leave reviews after completed cases.
- Send and receive messages with assigned lawyer.
- Use Legal RAG Assistant.
- Use platform chatbot tools when authenticated.

Client restrictions:

- Middleware redirects clients away from `/lawyer/*` to `/client/dashboard`.
- Cannot access `/admin/*`; middleware redirects to `/auth/admin/sign-in`.
- Cannot accept/reject appointment requests; that API requires `row.lawyer_id === user.id`.
- Cannot directly move a case to `pending_completion`; this is lawyer-side status management.
- Cannot mark a case completed unless DB allows `pending_completion -> completed`.
- Cannot upload case documents after case is `completed` or `closed`.
- Cannot add private notes on documents uploaded by the lawyer.
- Cannot comment on their own uploaded documents through the case document comments UI/policy.
- Cannot read other users' cases/documents/messages due to RLS and explicit query filters.

How client role is enforced:

- Middleware: if `pathname.startsWith("/lawyer/") && user_type === "client"`, redirect to `/client/dashboard`.
- RLS: client can only select/update/insert rows allowed by policies, typically `auth.uid() = client_id`, `uploaded_by`, `sender_id`, `recipient_id`, or case participant checks.
- Page queries: client case detail filters `.eq("client_id", session.user.id)`.
- API routes: appointment/document/summary/chat/history routes check authenticated user and row ownership/participation.

### Lawyer Role

Exact pages under lawyer area:

- `/lawyer/dashboard`
- `/lawyer/cases`
- `/lawyer/cases/[id]`
- `/lawyer/appointments`
- `/lawyer/judge-simulation`
- `/lawyer/messages`
- `/lawyer/profile`
- `/lawyer/profile/preview`

Exact actions lawyers can perform:

- Register and sign in through lawyer auth pages.
- Upload/resubmit license document when verification is rejected.
- Access lawyer dashboard only after verification.
- Manage lawyer profile, certifications, case studies, and availability/profile information.
- View assigned cases where `cases.lawyer_id = auth user`.
- View client profile info for assigned cases.
- Accept pending appointment requests.
- Reject pending appointment requests.
- Move accepted appointment to `awaiting_payment`.
- Reschedule eligible scheduled/rescheduled appointments.
- Submit support/admin cancellation request for paid scheduled/rescheduled appointments.
- Mark eligible consultations as held.
- Upload raw case documents from Documents tab while case is not `completed` or `closed`.
- Add private notes only on documents they uploaded.
- Comment on client-uploaded documents.
- View document analysis results available in case documents.
- Save private notes on case detail (`cases.private_notes`).
- Move case to `in_progress` only after held consultation.
- Request case completion by moving `in_progress -> pending_completion`, only after held consultation.
- Archive completed case by moving `completed -> closed`.
- Send/receive messages with clients.
- Use Legal RAG Assistant and platform tools.
- Use judicial simulation.

Lawyer restrictions:

- Middleware redirects lawyers away from `/client/*` to `/lawyer/dashboard`, except public `/client/lawyer/*`.
- Cannot access `/admin/*`; middleware redirects to `/auth/admin/sign-in`.
- Lawyer layout blocks the entire `/lawyer/*` area if `lawyer_profiles.verified` is false.
- Pending/rejected lawyers see verification pending/rejected screen instead of dashboard pages.
- Cannot accept/reject appointments unless `appointments.lawyer_id = user.id`.
- Cannot change case to `in_progress` or `pending_completion` before an attended/completed consultation.
- Cannot set case directly to `completed`; UI marks `Completed (Client confirms)` as disabled and DB requires `pending_completion`.
- Cannot revert active case back to `open`.
- Cannot upload case documents after case is `completed` or `closed`.

How lawyer role is enforced:

- Middleware role redirect for `/client/*`.
- Lawyer layout verification gate checks `lawyer_profiles.verified` and `verification_status`.
- RLS limits case/appointment/message/document access to participants.
- API routes verify `lawyer_id` on appointment/case actions.
- DB triggers enforce appointment and case status transitions.

### Admin Role

Exact admin pages:

- `/admin/dashboard`
- `/admin/users`
- `/admin/lawyers`
- `/admin/disputes`
- `/admin/cancellation-requests`
- `/admin/security-logs`
- `/admin/test-connection`

Exact actions admins can perform from current pages/routes:

- Access admin dashboards/pages when `profiles.user_type = 'admin'`.
- Review lawyers.
- Approve/reject lawyer verification from admin lawyer management.
- Review users/admin data pages.
- Review disputes.
- View AI security logs.
- Review appointment cancellation requests.
- Approve a `cancellation_requested` appointment, setting appointment to `cancelled`.
- Reject a `cancellation_requested` appointment, restoring status to `scheduled` or `rescheduled` based on `previous_status`.
- Trigger notifications/emails for cancellation resolution.
- View `/admin/test-connection`, which is now protected by `/admin/*` middleware.

Admin restrictions:

- Middleware only explicitly blocks non-admins from `/admin/*`.
- Middleware does not redirect admin users away from `/client/*` or `/lawyer/*`; however, client/lawyer page queries are generally scoped to client/lawyer IDs and will not show arbitrary data unless RLS/policies allow it.
- Admin UI access is not implemented as a separate `app/admin/layout.tsx`; admin checks are middleware plus page-level checks where present.

How admin role is enforced:

- Middleware: if path starts `/admin` and `profile.user_type !== "admin"`, redirect to `/auth/admin/sign-in`.
- Some admin pages also check `profile.user_type === "admin"` client-side and show Access Denied.
- Admin RLS helper functions `is_admin()` / `is_admin(user_id uuid)` are used in policies for admin read/update access.

## 2. Case Lifecycle

### Case Status Values

From scripts and app types:

| Status | Meaning |
|---|---|
| `open` | Case exists, lawyer may be assigned, but case work has not started. Consultation may be requested/accepted/paid/scheduled. |
| `in_progress` | Case work has started after at least one consultation is marked held/attended. |
| `pending_completion` | Lawyer requested completion and client must confirm or decline. |
| `completed` | Client confirmed completion. Related appointments are administratively closed as `completed`. |
| `closed` | Archived/closed state. DB guard prevents reopening from `closed`. |

### Valid Transitions and Triggers

| Transition | Trigger / code path | Enforced where |
|---|---|---|
| case created -> `open` | Case row creation / lawyer accepts request sets `status: "open"` | App + DB status check |
| historical `in_progress/pending_completion` without held consult -> `open` | Repair block in `scripts/051_case_status_transition_guard.sql` | SQL migration |
| `open -> in_progress` | `/api/appointments/mark-attended` after appointment becomes `attended` | App + DB trigger 051 |
| `in_progress -> pending_completion` | Lawyer case detail `handleRequestCompletion` / status update | App + DB triggers 047/051 |
| `pending_completion -> in_progress` | Client declines completion request | App + DB allows because not blocked by 051 |
| `pending_completion -> completed` | Client confirms completion | App + DB triggers 047/051 |
| `completed -> closed` | Lawyer archives completed case | App + DB allows |
| `closed -> anything else` | Not allowed | DB trigger 051 |
| active status -> `open` | Not allowed after active | App + DB trigger 051 |
| direct non-pending -> `completed` | Not allowed | DB triggers 047/051 |

### DB-Enforced Case Rules

`scripts/039_case_completion_workflow.sql`:

- Adds completion request fields.
- Allows status values `open`, `in_progress`, `pending_completion`, `completed`, `closed`.
- `cases_stamp_completion_request` stamps `completion_requested_at` and `completion_requested_by` when status becomes `pending_completion`.
- Clears completion request fields when returning from `pending_completion` to `in_progress` or moving to `completed`.
- `cases_sync_appointments_on_completed` marks related appointments `completed` when case becomes `completed`.

`scripts/047_require_attended_before_case_completion.sql`:

- `pending_completion` requires at least one appointment in `attended` or `completed`.
- `completed` must come from `pending_completion`.

`scripts/051_case_status_transition_guard.sql`:

- Repairs old rows by setting active cases back to `open` if no held consultation exists.
- Blocks transition out of `closed`.
- Blocks reverting any active case back to `open`.
- Blocks `in_progress` and `pending_completion` without held consultation.
- Blocks `completed` unless old status is `pending_completion`.

### App-Enforced Case Rules

Client case page:

- Client can confirm `pending_completion -> completed`.
- Client can decline `pending_completion -> in_progress`.
- Client review prompt opens after completion if not already reviewed.

Lawyer case page:

- Blocks `in_progress` if no attended/completed appointment.
- Blocks `pending_completion` if no attended/completed appointment.
- Blocks reverting active case to `open`.
- Disables `completed` option with label `Completed (Client confirms)`.
- Shows AI Summary tab only when case is not `open` and assigned participant exists.

### 8-Stage Stepper

File: `lib/case-lifecycle-stages.ts`

The stepper is UI-only. It derives display state from real case status, appointment statuses, and timeline events.

| Stage | Key | Exact condition for reached/current |
|---|---|---|
| 1 | `draft` / Case Created | Always reached if case row exists. |
| 2 | `consultation_requested` | Timeline has `CONSULTATION_REQUESTED` or `CONSULTATION_ACCEPTED`, or any appointment status is one of `pending`, `awaiting_payment`, `scheduled`, `rescheduled`, `attended`, `completed`. |
| 3 | `payment` | Timeline has `PAYMENT_COMPLETED`, or any appointment status is one of `scheduled`, `rescheduled`, `attended`, `completed`. |
| 4 | `consultation_scheduled` | Any appointment status is `scheduled`, `rescheduled`, `attended`, or `completed`. |
| 5 | `consultation_held` | Timeline has `CONSULTATION_ATTENDED`, or any appointment status is `attended` or `completed`. |
| 6 | `case_in_progress` | Case status is `in_progress`, `pending_completion`, `completed`, or `closed`, and a held consultation exists. |
| 7 | `pending_completion` | Case status is `pending_completion`, `completed`, or `closed`. |
| 8 | `completed` | Case status is `completed` or `closed`. |

Stage rendering:

- indexes lower than reached stage = `done`
- reached stage = `current`
- later stages = `upcoming`

## 3. Appointment Lifecycle

### Appointment Status Values

From scripts, app types, and `lib/appointments-status.ts`:

| Status | Meaning |
|---|---|
| `pending` | Client requested consultation; lawyer has not accepted/rejected. |
| `awaiting_payment` | Lawyer accepted request; client must pay. |
| `scheduled` | Payment confirmed and appointment slot is active. |
| `rescheduled` | Appointment time changed after scheduling. |
| `attended` | Consultation session was held; billable. |
| `completed` | Appointment row closed with completed case; set by case completion sync. |
| `cancelled` | Terminal cancelled state. |
| `rejected` | Terminal lawyer-rejected state. |
| `cancellation_requested` | Paid appointment cancellation is under admin/support review. |

### DB Trigger 044

`scripts/044_appointments_status_transition_guard.sql` creates `appointments_enforce_status_transition()`.

Allowed transitions in 044:

- `pending -> awaiting_payment | rejected | cancelled | scheduled | completed`
- `awaiting_payment -> scheduled | cancelled | completed`
- `scheduled -> attended | cancelled | rescheduled | completed`
- `rescheduled -> attended | cancelled | rescheduled | completed`
- `attended -> completed`

Blocked:

- Any transition out of `cancelled` or `rejected`.
- Any transition out of `completed`.
- Any unknown jump.

### DB Trigger Update 050

`scripts/050_add_reschedule_count.sql`:

- Adds `appointments.reschedule_count integer not null default 0`.
- Adds `appointments.previous_status text`.
- Updates `appointments_status_check` to include `cancellation_requested`.
- Replaces the transition guard to support cancellation-review flow.

Additional allowed transitions in 050:

- `scheduled -> cancellation_requested`
- `rescheduled -> cancellation_requested`
- `cancellation_requested -> cancelled`
- `cancellation_requested -> scheduled`
- `cancellation_requested -> rescheduled`

### Rescheduling Rules

File: `app/api/appointments/reschedule/route.ts`

Exact constants:

- `TWO_HOURS_MS = 2 * 60 * 60 * 1000`
- `TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000`
- `SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000`
- `SLOT_BUFFER_MINUTES = 60`

Rules:

- Auth required.
- Caller must be client or lawyer on the appointment.
- Appointment status must be `scheduled` or `rescheduled`.
- Cannot reschedule within 2 hours of current appointment start.
- New time must be at least 24 hours from now.
- New time must be within 60 days from now.
- Maximum reschedules: `3`.
- Conflict check blocks overlap with lawyer's appointments in `APPOINTMENT_SLOT_BLOCKING_STATUSES`.
- Blocking statuses are `pending`, `awaiting_payment`, `scheduled`, `rescheduled`, `cancellation_requested`, `attended`, `completed`.
- Effective duration for conflict is `max(duration_minutes, 60)`.
- On success:
  - update `scheduled_at`
  - set `status = "rescheduled"`
  - increment `reschedule_count`
  - create in-app notification
  - append `CONSULTATION_RESCHEDULED`
  - send `appointment_rescheduled` email

### Direct Cancellation Rules

File: `app/api/appointments/cancel/route.ts`

Rules:

- Auth required.
- Caller must be client or lawyer on the appointment.
- Only `pending` and `awaiting_payment` can be directly cancelled.
- Direct cancel sets appointment `status = "cancelled"`.
- If linked case exists:
  - case `lawyer_id = null`
  - case `status = "closed"`
- Creates in-app notification.
- Appends `APPOINTMENT_CANCELLED`.
- Sends `appointment_cancelled` email.

### Paid Cancellation Request Flow

File: `app/api/appointments/support-ticket/route.ts`

Rules:

- Auth required.
- Caller must be appointment client or lawyer.
- Message length must be at least 20 characters.
- Message length max is 2000 characters.
- Only `scheduled` and `rescheduled` appointments can enter support cancellation flow.
- Updates appointment:
  - `status = "cancellation_requested"`
  - `previous_status = old status`
- Appends `CANCELLATION_REQUESTED`.
- Notifies all admin users with `user_type = "admin"`.
- Sends support email to `SUPPORT_EMAIL` or fallback `support@wisecaseapp.com`.

Admin resolution page: `app/admin/cancellation-requests/page.tsx`

Approve:

- `cancellation_requested -> cancelled`
- clears `previous_status`
- sends `appointment_cancellation_resolved` email to client and lawyer
- inserts notifications for both parties
- appends `CANCELLATION_RESOLVED` with `resolution: "approved"`

Reject:

- Restores `previous_status === "rescheduled" ? "rescheduled" : "scheduled"`
- clears `previous_status`
- sends `appointment_cancellation_resolved` email to both parties
- inserts notifications for both parties
- appends `CANCELLATION_RESOLVED` with `resolution: "rejected"` and optional reason

### Mark Attended Rule

File: `app/api/appointments/mark-attended/route.ts`

Rules:

- Auth required.
- Caller must be client or lawyer on the appointment.
- Status must be `scheduled` or `rescheduled`.
- Can mark held when within 7 days before start or after start.
- If more than 7 days before start, returns error.
- Sets appointment `status = "attended"`.
- If case is `open`, sets case to `in_progress`.
- Appends `CONSULTATION_ATTENDED`.
- If case activated, appends `CASE_ACTIVATED`.

## 4. Document Analysis Pipeline

### Standalone AI Case Analysis Flow

Files:

- `app/client/analysis/page.tsx`
- `components/documents/upload-zone.tsx`
- `app/api/analyze-document/route.ts`
- `lib/analysis/run-document-analysis.ts`

Steps:

1. Client opens `/client/analysis`.
2. `UploadZone` accepts one file.
3. Accepted file types:
   - PDF: `.pdf`
   - image: `.jpg`, `.jpeg`, `.png`
   - Word: `.doc`, `.docx`
4. Max file size: `10 * 1024 * 1024` bytes = 10MB.
5. File uploads to Supabase storage bucket `documents`.
6. Storage path is `{caseId || user.id}/{random}.{ext}`.
7. A `documents` row is inserted with:
   - `uploaded_by`
   - optional `case_id`
   - `file_name`
   - `file_url`
   - `file_type`
   - `file_size`
   - `status = "pending"`
8. `onUploadComplete(documentId)` calls `/api/analyze-document`.
9. API verifies auth.
10. API verifies document exists.
11. API verifies user is uploader or case participant.
12. `runDocumentAnalysis` sets document `status = "analyzing"`.
13. Fetches file from `document.file_url`.
14. If PDF, extracts text with `pdf-parse-fork`.
15. If image or image filename, switches to vision model and sends base64 image.
16. If Word document and no extraction available, uses metadata fallback text.
17. Runs prompt-injection scanner on first 120,000 chars for non-image text.
18. Logs up to 8 security hits into `ai_security_logs`.
19. Sends sanitized first 6000 chars to Groq.
20. Parses JSON response.
21. Normalizes legal-document flag, confidence, risk, urgency, seriousness.
22. Inserts `document_analysis` row.
23. Updates document `status = "completed"`.
24. Appends `AI_ANALYSIS_COMPLETED` timeline event.
25. Upserts a `case_drafts` row after analysis.
26. Sends analysis-complete notification for legal documents.
27. Matches recommended lawyers if document is legal and confidence is not low.
28. UI renders `AnalysisResultsView`, Case Strength Meter, recommendations, citations, and disclaimer.

### Case Documents Tab Upload Flow

File: `components/cases/case-documents-panel.tsx`

Purpose:

- Raw shared case documents, not automatic AI analysis.

Rules:

- Upload button shown only if case status is not `completed` and not `closed`.
- Max file size: 10MB.
- Accepted extensions: `.pdf`, `.doc`, `.docx`, `.jpg`, `.jpeg`, `.png`.
- Uploads to Supabase storage `documents`.
- Inserts `documents` row with:
  - `case_id`
  - `uploaded_by`
  - safe file name
  - file URL/type/size
  - `document_type = "case_document"`
  - `status = "pending"`
- Does **not** call `/api/analyze-document`.
- Appends `DOCUMENT_UPLOADED`.
- Shows uploader line: `Uploaded by You` or `Uploaded by [Name] (Client/Lawyer)`.
- Own uploaded documents allow private note.
- Other party documents allow comments.

### Security Scanner Categories

File: `lib/document-analysis-security.ts`

Pattern count: 34.

Eight categories:

1. `instruction_override`
2. `system_prompt_extract`
3. `role_play_attack`
4. `config_extract`
5. `fake_urgency`
6. `result_manipulation`
7. `code_injection_text`
8. `prompt_stuffing`

### Exact Analysis Fields

For legal documents, prompt asks Groq to return:

- `is_legal_document`
- `confidence_score`
- `detected_language`
- `summary`
- `key_terms`
- `risk_assessment`
- `risk_level`
- `urgency`
- `seriousness`
- `recommendations`
- `category`
- `legal_citations`
- `disclaimer`

For non-legal documents, prompt asks for same core shape with:

- `is_legal_document: false`
- `risk_level: "N/A"`
- `urgency: "N/A"`
- `seriousness: "N/A"`
- `category: "Non-Legal"`
- empty `key_terms`
- empty `legal_citations`

Stored DB payload includes:

- `document_id`
- `summary`
- `key_terms`
- `risk_assessment`
- `recommendations` as JSON string
- `extracted_text` first 2000 chars
- `analysis_status = "completed"`
- `legal_citations`
- `disclaimer`
- `risk_level`
- `urgency`
- `seriousness`
- `category`
- `confidence_score`
- `detected_language`
- `processing_time_ms`
- `ai_model_version`
- `is_legal_document`

### `is_legal_document` Detection

The model performs classification first under a strict prompt:

Legal examples:

- contracts
- agreements
- court orders
- FIRs
- legal notices
- wills
- power of attorney
- affidavits
- petitions
- bail applications
- lease/tenancy agreements
- partnership deeds
- MOUs with legal terms
- statutory instruments
- legal opinions
- case judgments
- arbitration awards
- legal correspondence between advocates

Non-legal examples:

- professional licenses
- bar council certificates
- CNIC/ID cards
- CVs/resumes
- proposals
- business plans
- invoices
- receipts
- academic transcripts
- general letters/emails
- presentations
- recipes/articles/blogs/marketing material
- photos of people/places
- non-legal administrative documents

Code behavior:

- `const isLegalDoc = result.is_legal_document === true`
- Only strict boolean `true` counts as legal.
- Confidence is clamped to `0..1`.
- `lowConfidence = confidence < 0.5 && isLegalDoc`.
- If non-legal, lawyer matching returns an empty list.

### Case Strength Meter Formula

File: `components/documents/case-strength-meter.tsx`

Risk score:

- `Low = 70`
- `Medium = 45`
- `High = 20`
- fallback = 45

Urgency score:

- `Normal = 15`
- `Urgent = 10`
- `Immediate = 5`
- fallback = 10

Seriousness score:

- `Low = 15`
- `Moderate = 10`
- `Critical = 5`
- fallback = 10

Formula:

```text
score = riskScore + urgencyScore + seriousnessScore
```

Labels:

- score >= 70: `Strong Case`
- score >= 40: `Moderate Case`
- otherwise: `Needs Attention`

### Lawyer Matching

File: `lib/ai/lawyer-matching.ts`

Input:

- analysis `category`

Process:

1. Fetches all `profiles` with `user_type = "lawyer"` and joined `lawyer_profiles`.
2. Tokenizes category into lowercase non-stopword keywords.
3. Stop words: `law`, `legal`, `and`, `practice`, `specialist`, `specialization`, `expert`.
4. Filters lawyers whose `lawyer_profiles.specializations` contain at least one category keyword as a whole word.
5. Calculates score:
   - exact specialization equal to category: +100
   - each keyword whole-word match: +50
   - average rating: `rating * 5`
   - verified lawyer: +20
   - success rate: `success_rate / 10`
6. Filters out matches below 50.
7. Sorts by match score, then rating.
8. Returns top 6.

## 5. RAG Chatbot

Implementation:

- API: `app/api/legal-rag-chat/route.ts`
- UI: `components/rag/legal-rag-assistant.tsx`
- Launcher: `components/rag/legal-rag-launcher.tsx`
- Root mounted in `app/layout.tsx`

### Query Classification Categories

Function: `classifyQuery(query)`.

Categories:

| Classification | Trigger | Behavior |
|---|---|---|
| `greeting` | `hi`, `hello`, `hey`, `salam`, `assalamualaikum`, `aoa`, good morning/afternoon/evening | Returns static greeting; no Pinecone retrieval. |
| `capability` | "what can you do", "who are you", "help", etc. | Returns static capabilities response; no Pinecone retrieval. |
| `refuse:jailbreak` | Prompt/system override, reveal prompt, jailbreak, answer without context, leak secrets/API keys | Returns refusal text. |
| `refuse:tooVague` | Query length under 4 chars after normalization | Asks for a specific Pakistani legal question. |
| `platform` | Lawyer search, profile, appointments, cases, documents, analysis, WiseCase policies, upload/navigation/platform terms | Uses Groq with WiseCase tools instead of Pinecone retrieval. |
| `refuse:privateData` | Private data/database/user record requests that are not recognized platform tool requests | Refuses private data access. |
| `refuse:nonPakistan` | Other jurisdictions like India/USA/UK/Canada/etc. without Pakistani framing | Refuses non-Pakistani law. |
| `refuse:irrelevant` | Clearly non-legal/non-platform topics or no legal terms | Refuses as out of scope. |
| `retrieve` | Pakistani legal terms, sections, statute/procedure/evidence/family/tax/labour/immigration/contract/property/civil/criminal terms | Searches Pinecone, gates by score, streams Groq answer with citations. |

### What Happens for Retrieval

1. Validates request size under `80,000` bytes.
2. Normalizes up to 10 latest messages.
3. Each message content max is 3500 chars.
4. Authenticates user if session exists; guests allowed.
5. Applies rate limit:
   - guest: 8/minute
   - authenticated: 30/minute
6. Classifies query.
7. Checks env `PINECONE_API_KEY` and `GROQ_API_KEY`.
8. Expands legal query with Pakistani law synonyms for topics like murder, theft, robbery, kidnapping, family, tax, labour, immigration, contract.
9. Searches Pinecone namespace.
10. Search filter: `jurisdiction = Pakistan`.
11. Search fetch count: `min(max(topK * 4, 12), 40)`.
12. Reranks/boosts hits for exact section and topic terms.
13. Final topK default: 8.
14. If no hits or best score below `0.42`, returns "knowledge base does not contain that reference yet."
15. Builds strict Pakistani-law system prompt.
16. Streams answer with citations.
17. Saves authenticated chat messages to DB.

### Platform Tools Integrated With RAG

If classification is `platform`, Legal RAG route uses same tool set from `lib/ai/tools.ts`.

Authenticated users get all tools:

- `getProfileStatus`
- `updateProfile`
- `getMyDataSummary`
- `searchLawyers`
- `searchReviews`
- `getPlatformFAQ`
- `getCaseAnalysisSummary`

Guests get public platform tools only:

- `searchLawyers`
- `searchReviews`
- `getPlatformFAQ`

Tool step limit:

- `stopWhen: stepCountIs(3)`

### Guest vs Authenticated Behavior

Guest:

- Role is `guest`.
- Uses session storage key `wisecase-legal-rag-chat`.
- Can ask public legal KB questions.
- Can use public lawyer search/review/FAQ tools.
- Cannot upload/analyze documents through the RAG UI unless signed in; upload handler throws `Please sign in to upload and analyze documents.`
- No DB chat history.
- Rate limit 8/minute.

Authenticated:

- Role loaded from `profiles.user_type`; normalized to `client` or `lawyer` in UI.
- Chat history loads from `/api/chat/history`.
- Legal RAG route saves both user and assistant messages into `ai_chat_messages`.
- If on a case URL or `?case=`, route validates case participation before assigning `case_id`.
- Can use private platform tools.
- Can upload documents from the RAG UI for analysis.
- Rate limit 30/minute.

### Voice Input and TTS

Voice input:

- Implemented in `components/rag/legal-rag-assistant.tsx`.
- Uses browser `window.webkitSpeechRecognition || window.SpeechRecognition`.
- `continuous = false`
- `interimResults = false`
- `lang = "en-US"`
- On result, transcript is copied into the input field.
- Mic button disabled if SpeechRecognition is unavailable.

Text-to-speech:

- Uses `window.speechSynthesis`.
- Speaker toggle controls `shouldReadAloud`.
- On assistant final response or document analysis completion, `speak(text)` creates `SpeechSynthesisUtterance`.
- Before speaking, strips control markers like `[ACTION:*]`, `[NAVIGATE:*]`, `[VIEW_ANALYSIS:*]`.
- Cancels speech when muted or component unmounts.

### Session Storage vs DB Storage

Guest:

- Session storage key: `wisecase-legal-rag-chat`.
- Messages are saved client-side only after history is ready.
- Clear chat removes session storage.

Authenticated:

- History loads from `/api/chat/history`.
- Route stores messages in `ai_chat_messages`.
- If a valid case context exists, messages are stored with `case_id`.
- "Load older messages" uses `before` cursor from `created_at`.
- Clear chat calls `DELETE /api/chat/history`.
- If no case context, clear requires `scope=global`.

## 6. Security Measures

### Middleware RBAC

File: `lib/supabase/middleware.ts`

Logic:

- Public routes bypass auth.
- Unauthenticated non-public requests redirect:
  - `/admin*` -> `/auth/admin/sign-in`
  - `/lawyer/*` -> `/auth/lawyer/sign-in`
  - other protected route -> `/auth/client/sign-in`
- Role checks run for `/admin`, `/client/`, `/lawyer/`.
- `/admin*` requires `profile.user_type === "admin"`.
- `/client/*` blocks lawyers and redirects them to `/lawyer/dashboard`.
- `/lawyer/*` blocks clients and redirects them to `/client/dashboard`.

### Lawyer Verification Gate

File: `app/lawyer/layout.tsx`

- Loads `lawyer_profiles.verified` and `verification_status`.
- If not verified, shows verification pending/rejected screen instead of lawyer app.
- Rejected lawyers can upload a new license document to storage bucket `verifications` and set `verification_status = "pending"`.

### Supabase RLS

RLS-enabled tables/policies include:

- `profiles`
- `lawyer_profiles`
- `cases`
- `appointments`
- `documents`
- `document_analysis`
- `payments`
- `reviews`
- `messages`
- `certifications`
- `notifications`
- `ai_chat_messages`
- `case_studies`
- `case_disputes`
- `case_drafts`
- `case_timeline_events`
- `ai_security_logs`
- `document_analysis_jobs`
- `case_document_notes`
- `case_document_comments`

RLS policy themes:

- Users can access own profile rows.
- Case participants can access related cases, appointments, documents, analyses, timeline, and messages.
- Public can view published/public lawyer-facing data.
- Admin helper functions allow admin access where defined.
- Document notes are private to note owner and only for own uploaded documents.
- Document comments are visible to case participants and inserted only on the other party's documents.

### API Authorization

Examples:

- Case summary route requires auth and `case.client_id === user.id || case.lawyer_id === user.id`.
- Appointment routes require auth and participant checks.
- Appointment respond requires `row.lawyer_id === user.id`.
- Document analysis requires uploader or case participant.
- Chat history validates requested case context before loading/deleting case-scoped history.
- Cron route requires `CRON_SECRET` bearer or `x-vercel-cron: 1`.

### Rate Limiting

File: `lib/rate-limit.ts`

Implementation:

- In-memory `Map`.
- Key shape: `${namespace}:${key}`.
- Resets bucket after `windowMs`.
- Returns `Retry-After` seconds when limited.

Configured limits:

| Route | Namespace | Limit |
|---|---|---:|
| `/api/chat` | `api-chat-post` | 25/minute |
| `/api/legal-rag-chat` guest | `api-legal-rag-chat` | 8/minute |
| `/api/legal-rag-chat` authenticated | `api-legal-rag-chat` | 30/minute |
| `/api/analyze-document/job/[jobId]` | `analysis-job-poll` | 90/minute per `user:job:ip` |

Limitation:

- In-memory rate limiting is per server instance and resets on cold start/redeploy.

### Prompt Injection Defense

Document analysis:

- Pre-LLM scanner with 34 regex patterns and 8 attack categories.
- Logs detections in `ai_security_logs`.
- Prompt treats document text as untrusted data.
- High severity hits add a security warning block.
- Prompt tells model to ignore embedded instructions and classify malicious/non-legal instruction documents as non-legal.
- Extracted text sent to model is sanitized and truncated to first 6000 chars.

RAG chatbot:

- Query classifier refuses jailbreak/prompt/system/secret extraction attempts before retrieval.
- RAG system prompt says not to follow instructions that change rules, bypass retrieval, reveal prompts, or invent law.
- Retrieval score gate prevents weak matches from being answered as law.
- Legal scope is Pakistan-only.
- Private data requests are refused unless routed through authenticated platform tools.

AI Case Summary:

- Prompt starts with explicit security instruction treating case data/document summaries/timeline as untrusted.
- Model output is normalized.
- `overall_strength` is clamped server-side to `0..100`.
- Invalid `risk_level` normalizes to `Medium`.

### Stripe Security

File: `app/api/stripe/webhook/route.ts`

- Reads raw body with `request.text()`.
- Requires `stripe-signature` header.
- If `STRIPE_WEBHOOK_SECRET` exists, verifies with `stripe.webhooks.constructEvent`.
- If secret is missing, logs warning and parses JSON directly for development.
- Uses `createAdminClient()` because webhook has no Supabase session cookies.

### Email/XSS Measures

- Email helper includes `escapeHtml`.
- Email templates and direct support/webhook emails escape user-supplied names, emails, case titles, and messages where currently patched.

### Upload Controls

- Document upload max size: 10MB in `UploadZone` and case documents panel.
- Accepted MIME/extensions are constrained in UI.
- Storage operations still rely on Supabase storage/RLS policies for server-side enforcement.

### Build Config Security Limitation

`next.config.mjs` currently has:

- `eslint.ignoreDuringBuilds = true`
- `typescript.ignoreBuildErrors = true`
- `images.unoptimized = true`

These are known project limitations for production hardening.

## 7. Real-Time Features

### Root-Level Notifications

`app/layout.tsx` mounts:

- `NotificationToastListener`
- `NotificationBell` appears in headers
- `MessageBadge` appears where imported

### Subscriptions

| Page / Component | Channel | Table / Event | Filter | Cleanup |
|---|---|---|---|---|
| `app/client/cases/[id]/page.tsx` | `client-case-detail-${caseId}-${Date.now()}` | `cases`, event `*` | `id=eq.${caseId}` | `supabase.removeChannel(channel)` |
| `app/client/cases/[id]/page.tsx` | same | `appointments`, event `*` | `case_id=eq.${caseId}` | same |
| `app/client/cases/[id]/page.tsx` | same | `documents`, event `*` | `case_id=eq.${caseId}` | same |
| `app/client/cases/[id]/page.tsx` | same | `case_timeline_events`, event `*` | `case_id=eq.${caseId}` | same |
| `app/lawyer/cases/[id]/page.tsx` | `lawyer-case-detail-${caseId}-${Date.now()}` | `cases`, event `*` | `id=eq.${caseId}` | `supabase.removeChannel(channel)` |
| `app/lawyer/cases/[id]/page.tsx` | same | `appointments`, event `*` | `case_id=eq.${caseId}` | same |
| `app/lawyer/cases/[id]/page.tsx` | same | `documents`, event `*` | `case_id=eq.${caseId}` | same |
| `app/lawyer/cases/[id]/page.tsx` | same | `case_timeline_events`, event `*` | `case_id=eq.${caseId}` | same |
| `app/client/appointments/page.tsx` | `appointments-client-${clientId}-${Date.now()}` | `appointments`, event `UPDATE` | `client_id=eq.${clientId}` | `supabase.removeChannel(channel)` |
| `app/client/appointments/page.tsx` | same | `appointments`, event `INSERT` | `client_id=eq.${clientId}` | same |
| `app/client/appointments/page.tsx` | same | `payments`, event `*` | `client_id=eq.${clientId}` | same |
| `app/client/appointments/page.tsx` | same | `cases`, event `UPDATE` | `client_id=eq.${clientId}` | same |
| `app/lawyer/appointments/page.tsx` | `appointments-lawyer-${lawyerId}-${Date.now()}` | `appointments`, event `INSERT` | `lawyer_id=eq.${lawyerId}` | `supabase.removeChannel(channel)` |
| `app/lawyer/appointments/page.tsx` | same | `appointments`, event `UPDATE` | `lawyer_id=eq.${lawyerId}` | same |
| `components/chat/messages-shell.tsx` | `messages-case-${activeCaseId}` | `messages`, event `INSERT` | `case_id=eq.${activeCaseId}` | `supabase.removeChannel(channel)` |
| `components/chat/messages-shell.tsx` | same | `messages`, event `UPDATE` | `case_id=eq.${activeCaseId}` | same |
| `components/chat/messages-shell.tsx` | same | broadcast `typing` | same channel | same |
| `components/chat/messages-shell.tsx` | `messages-recipient-${currentUserId}` | `messages`, event `INSERT` | `recipient_id=eq.${currentUserId}` | `supabase.removeChannel(channel)` |
| `components/lawyer/active-cases.tsx` | dynamic topic | `cases`, event `*` | `lawyer_id=eq.${lid}` | `supabase.removeChannel(channel)` |
| `components/lawyer/active-cases.tsx` | same | `messages`, event `*` | none | same |
| `components/lawyer/client-requests.tsx` | dynamic `channelName` | `appointments`, event `*` | `lawyer_id=eq.${userId}` | removes existing channels, then `supabase.removeChannel(channel)` |
| `components/lawyer/upcoming-appointments.tsx` | dynamic topic | `appointments`, event `*` | `lawyer_id=eq.${lid}` | `supabase.removeChannel(channel)` |
| `components/lawyer/profile-completion-card.tsx` | `profile-completion-sync` | `profiles`, event `*` | none | `supabase.removeChannel(channel)` |
| `components/lawyer/profile-completion-card.tsx` | same | `lawyer_profiles`, event `*` | none | same |
| `components/lawyer/verification-notice.tsx` | `verification-sync` | `lawyer_profiles`, event `*` | `id=eq.${userId}` if user exists | `supabase.removeChannel(channel)` |
| `components/notifications/message-badge.tsx` | `unread-messages-${session.user.id}` | `messages`, event `*` | `recipient_id=eq.${session.user.id}` | `supabase.removeChannel(channel)` |
| `components/notifications/notification-bell.tsx` | `notifications-${userId}-${Date.now()}` | `notifications`, event `*` | `user_id=eq.${userId}` | `supabaseRtm.removeChannel(ch)` |
| `components/notifications/notification-toast-listener.tsx` | dynamic `channelName` | `notifications`, event `INSERT` | `user_id=eq.${session.user.id}` | removes existing channel and cleanup removes current channel |

## 8. Known Limitations

### Disabled / Incomplete

- `next.config.mjs` ignores TypeScript and ESLint errors during builds.
- Admin area has no dedicated `app/admin/layout.tsx`; protection is middleware plus page-level checks.
- Middleware does not redirect admin users away from client/lawyer routes, though page queries and RLS still limit data.
- Stripe webhook verification is skipped if `STRIPE_WEBHOOK_SECRET` is missing; this is acceptable only for local development.
- In-memory rate limits are not distributed across serverless instances.
- Case document tab uploads are raw shared docs and intentionally do not trigger AI analysis.
- OCR for scanned/image-heavy legal books is not part of the RAG ingestion flow.
- Word document text extraction in document analysis is a metadata fallback, not real DOC/DOCX parsing.
- RAG namespace default remains `criminal-law` even though multiple legal corpora are currently indexed into it.
- RAG answer quality depends on Pinecone integrated embedding availability and Groq availability.
- Some UI real-time subscriptions use broad table events with client-side refetching, which is simple but not highly optimized.
- Some pages rely on client-side redirects/checks in addition to middleware/RLS, so initial loading screens may briefly appear.

### Deferred / Needs More Production Hardening

- Replace in-memory rate limiting with Redis/Upstash/Supabase-backed distributed rate limits.
- Turn TypeScript and ESLint build checks back on and fix resulting issues.
- Add server-side file MIME validation beyond UI accept filters.
- Add malware scanning for uploaded files.
- Add robust OCR ingestion for scanned legal PDFs.
- Add source-tier metadata and scheduled refresh for legal corpora.
- Add automated tests for lifecycle transitions, appointment cancellation, RAG refusal behavior, and Stripe webhooks.
- Add webhook dead-letter/retry monitoring.
- Add structured audit logs for admin actions.
- Add stricter admin route layout with server-side role enforcement.
- Add production observability for Groq/Pinecone failures and latency.
- Add DB-level limits for reschedule count if required; currently max 3 is enforced by app route, while DB stores the counter.
- Review all Realtime subscriptions for least-privilege filters and performance.
