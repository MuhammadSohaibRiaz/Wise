# Wisecase — Current Product Workflows (Reference)

This document describes **what is implemented today** in the Wise/Wisecase codebase (Next.js app + Supabase + Stripe + Groq). Use it to compare against desired UX and to refine flows with other LLMs or stakeholders.

**Scope:** Application behavior as wired in routes, components, and API routes—not aspirational roadmap items unless noted.

---

## 1. Roles & authentication

| Role | How it is represented |
|------|------------------------|
| **Client** | `profiles.user_type === "client"` |
| **Lawyer** | `profiles.user_type === "lawyer"` |
| **Admin** | `profiles.user_type === "admin"` |

- Users sign up / sign in via **Supabase Auth** (email flows under `/auth/client/*`, `/auth/lawyer/*`, `/auth/admin/*`).
- After registration, lawyers land in a **pending verification** state until an admin approves (see §4).
- **Environment:** Production deployments need Supabase URL/keys, Stripe keys, and `GROQ_API_KEY` for AI features.

---

## 2. Client workflows

### 2.1 Discovery & matching

- **`/match`** — Lists lawyers from `profiles` + `lawyer_profiles` (active profiles, filters by specialization, rating, rate, location).
- **`/client/ai-recommendations`** — Client enters case type/description; matching uses **`matchLawyersWithCategory`** (AI-assisted categorization + lawyer matching).
- **`/client/dashboard`** — Overview stats, suggested lawyers, notifications (with realtime updates on relevant tables).

### 2.2 Booking a consultation

**Entry points:** “Book” on lawyer cards, **`BookAppointmentModal`** from `/match`, lawyer profile, etc.

**Flow (implemented in `book-appointment-modal.tsx`):**

1. Client picks date, time slot, duration (30/60/90 min), case type, title, description.
2. Optional: **`sessionStorage`** may auto-fill description from **`active_analysis_summary`** if the client analyzed a document first (see §7).
3. **Case row** is created: `cases` with `status: "open"`, linked `client_id`, `lawyer_id`, hourly rate snapshot.
4. **Appointment** is created with `status: "pending"` (or falls back to `"scheduled"` if DB constraints do not allow `pending`).
5. **Notification** to lawyer: `notifyAppointmentRequest(...)`.
6. Client sees success (“request sent”); lawyer must act on **`/lawyer/appointments`**.

**Document linkage:** If `active_analysis_doc_id` exists in `sessionStorage`, the **`documents`** row is updated with `case_id` for the new case, then storage keys are cleared.

### 2.3 Lawyer accepts → client pays

**Lawyer side (`/lawyer/appointments`):**

- **Accept** on a `pending` request → appointment becomes **`awaiting_payment`** (after overlap checks with other scheduled slots).

**Client side (`/client/appointments`):**

- Sees **awaiting payment** state.
- Client completes payment via **Stripe** (see §8). On success, webhook/verify paths set payment **`completed`**, appointment **`scheduled`**, and case **`in_progress`**.

### 2.4 Appointments lifecycle (high level)

Statuses used in UI include: **`pending`**, **`awaiting_payment`**, **`scheduled`**, **`attended`**, **`completed`**, **`cancelled`**, **`rescheduled`**, **`rejected`**.

- **`attended`** — Consultation held (distinct from case closure); aligned with SQL scripts (e.g. 042).
- **`completed`** — Often tied to **case closure workflow** / triggers (see §9).

### 2.5 Cases

- **`/client/cases`** — List with realtime; may show **dispute open** badges when rows exist in **`case_disputes`** with open/under-review statuses (implementation uses dispute table, not only `cases.status`).
- **`/client/cases/[id]`** — Case detail: documents, messages link, **completion** flow when lawyer proposes closing (`pending_completion`), client can confirm, etc.

### 2.6 Messages

- **`/client/messages`** — Messaging tied to cases/lawyers (Supabase-backed).

### 2.7 Reviews

- After a case is **`completed`**, clients may be prompted via **`PendingCaseReviewDialog`** on the dashboard.
- Submitting a review inserts into **`reviews`** and calls **`recomputeLawyerRatingStats`** to refresh **`lawyer_profiles.average_rating`** (and related aggregates).

### 2.8 Payments overview

- **`/client/payments`** — Client-facing payment history / status.

### 2.9 Raise a dispute

- From case UI, **`DisputeModal`** inserts into **`case_disputes`** (`reason`, `description`, `status: "open"`).
- The modal also attempts **`cases.status = "disputed"`**. **Note:** Your SQL migrations (e.g. case status check in `039`) may define allowed statuses as `open | in_progress | pending_completion | completed | closed`—if `disputed` is not in the constraint, this update can fail at runtime until the schema is aligned. Dispute **records** remain the structured source for admin workflow regardless.

### 2.10 Document analysis (client)

- **`/client/analysis`** — Upload via **`UploadZone`** → file stored, **`documents`** row → **`POST /api/analyze-document`** with `{ documentId, async: true }`.
- API enqueues into **`document_analysis_jobs`** and returns `jobId`; UI polls **`GET /api/analyze-document/job/[jobId]`** until completed.
- Worker path also exists at **`GET /api/cron/process-analysis-jobs`** (Vercel cron / bearer secret) so queued jobs drain even without active polling.
- Completed job writes **`document_analysis`** and returns summary/risk/citations + **`recommendedLawyers`** via `matchLawyersWithCategory`.
- Non-legal uploads may return `isLegalDocument: false` with limited recommendations.

### 2.11 Judge simulation (client)

- **`/client/judge-simulation`** — **`JudgeSimulationView userRole="client"`**.
- **Manual mode:** User enters case description and/or arguments → **`POST /api/judge-simulation`** (auth required). Groq returns structured judicial-style JSON (Pakistan focus, guardrails vs non-legal input).
- **Document mode:** User can pick an **analyzed document** (filtered by uploader’s `user_type` matching **client**) to pre-fill **case description** from analysis summary; arguments still user-editable; same API call for simulation.

**Why clients use it:** Positioned as **strategy / outcome preview** before court (“validate case strategy”).

---

## 3. Lawyer workflows

### 3.1 Registration

- **`/auth/lawyer/register`** — Creates auth user, uploads license file to Storage bucket **`verifications`**, sets **`lawyer_profiles`**: `bar_license_number`, `specializations`, `license_file_url`, **`verification_status: "pending"`**, **`verified: false`**.

### 3.2 Profile & license (AI assist + admin)

- **`/lawyer/profile`** — Lawyer maintains bio, rates, license fields, optional new license document.
- On new license upload: profile may reset to **`verification_status: "pending"`**, **`verified: false`**; optional call to **`POST /api/lawyer/verify-license`** (Groq vision): compares extracted license number to claimed number, stores **`ai_license_match`**, **`ai_extracted_license`** on **`lawyer_profiles`**.
- **`VerificationNotice`** component surfaces pending/rejected/unverified states (subscribes to **`lawyer_profiles`** changes).

### 3.3 Admin verification (human gate)

- **`/admin/lawyers`** — Lists lawyers with **`verification_status === "pending"`**; admin can approve/reject (updates **`lawyer_profiles`** / **`verified`** / **`verification_status`**—see page implementation for exact fields).

### 3.4 Dashboard & hub

- **`/lawyer/dashboard`** — Header stats, sidebar stats, active cases, upcoming appointments, client requests, notifications.
- Realtime subscriptions used on several widgets so lists refresh when data changes.

### 3.5 Appointments

- **`/lawyer/appointments`** — Pending requests → **Accept** (→ `awaiting_payment`) or reject; manage upcoming **`scheduled`**, etc.

### 3.6 Cases

- **`/lawyer/cases`** and **`/lawyer/cases/[id]`** — Work on active matters; completion proposal flows (`pending_completion`) per DB triggers and UI.

### 3.7 Judge simulation (lawyer)

- **`/lawyer/judge-simulation`** — Same component with **`userRole="lawyer"`**; document picker filters analyzed docs where uploader is a **lawyer** (`profiles.user_type`).
- **Why lawyers use it:** Copy positions tool as **argument stress-test** against a strict judicial persona.

### 3.8 Availability

- **`AvailabilityCalendar`** / profile-related scheduling supports slot conflicts when accepting bookings.

---

## 4. Lawyer verification (end-to-end)

1. **Upload** license at registration or profile → stored URL on **`lawyer_profiles`**.
2. **AI check** (optional path): vision model extracts license number; **`ai_license_match`** boolean stored.
3. **Admin** on **`/admin/lawyers`** approves or rejects → **`verified`**, **`verification_status`**, timestamps as implemented.
4. **Verified lawyers** are trusted for public discovery; unverified lawyers may see **`VerificationNotice`** and may be excluded or down-ranked depending on query filters.

---

## 5. Admin workflows

- **`/admin/dashboard`** — High-level admin entry.
- **`/admin/lawyers`** — Lawyer verification queue.
- **`/admin/disputes`** — Lists **`case_disputes`** with joins to case and parties. **Resolve** sets dispute **`status: "resolved"`**, **`admin_notes`**, **`resolved_at`**. (Does not automatically change **`cases.status`** in current code—only dispute row is updated.)
- **`/admin/users`** — User administration (as implemented on that page).

---

## 6. Dispute resolution (current)

| Step | Behavior |
|------|----------|
| Create | Client (or authorized user per RLS) inserts **`case_disputes`** with `status: 'open'`. UI may set **`cases.status`** to `disputed` (schema must allow). |
| Triage | Admin views **`/admin/disputes`**. |
| Resolve | Admin sets **`status: "resolved"`**, adds **`admin_notes`**, **`resolved_at`**. |

**RLS (from scripts):** Parties on the case, raiser, and admins can **`SELECT`**; clients insert with **`raised_by = auth.uid()`**; admins have broader access.

**Product note:** “Disputed” as a **case** status vs **open dispute row**—discuss whether completion/payment should be blocked while `case_disputes` is open.

---

## 7. Document analysis (technical path)

1. Upload → **`documents`** (`status` transitions e.g. → `analyzing` → completed).
2. **`/api/analyze-document`**: fetch file from **`file_url`**, PDF parse or image to Groq vision, structured JSON → **`document_analysis`** + update document status.
3. Downstream: recommendations on analysis page, chat widget can call same API after upload (`Chat.tsx`), booking pre-fill via **`sessionStorage`**.

---

## 8. Payments & when money moves

**Primary flows:**

### 8.1 Stripe Payment Intent (embedded checkout component)

- **`POST /api/stripe/create-payment-intent`** — Authenticated client; creates **`payments`** row (`status: pending`), creates **Stripe PaymentIntent**, stores `stripe_payment_id`.
- Client confirms in **`stripe-checkout`** / Elements; success polls **`payments`** until **`completed`** (or webhook updates).

### 8.2 Stripe Checkout Session (hosted)

- **`POST /api/stripe/create-checkout-session`** — Creates Checkout session with metadata: **`appointment_id`**, **`payment_id`**, etc.
- Success/cancel URLs point to **`/client/appointments`** with query params.

### 8.3 Webhook & verify

- **`POST /api/stripe/webhook`** — On **`checkout.session.completed`**: set **`payments.status = completed`**, appointment **`scheduled`**, case **`in_progress`**, notifications as coded.
- **`POST /api/stripe/verify-payment`** — Client can verify a **`sessionId`** after redirect; same style of updates if **`payment_status === paid`**.

**Business rule (implemented):** Payment success moves the **case** from idle/open into **`in_progress`** and locks in the **appointment** as **`scheduled`** (consultation paid; not yet “attended” unless user flows mark that separately).

**Amount:** Derived from appointment duration and lawyer hourly rate (see **`create-payment-intent`** logging/calculation).

---

## 9. Case completion workflow (database + UX)

From **`039_case_completion_workflow.sql`** (and related UI):

- **`cases.status`** values include **`pending_completion`** (proposal), **`completed`**, **`closed`**, etc.
- Triggers stamp **`completion_requested_at`**, **`completion_requested_by`** (`lawyer` | `client`).
- When case becomes **`completed`**, related appointments may be synced to **`completed`** (see trigger); script **042** adds **`attended`** for “held consultation” vs “case closed”.

**UX:** Lawyer/client flows on case detail to propose and confirm completion; client review dialog after completion (§2.7).

---

## 10. AI chat (brief)

- **`/api/chat`** and **`Chat`** / **`messages-shell`** — Conversational assistant with tool-calls.
- History is persisted in **`ai_chat_messages`** and now supports optional **`case_id`** context.
- **`/api/chat/history`** supports:
  - case-context filtering (`caseId` / inferred from `currentPath`)
  - pagination (`limit`, `before`) for older message retrieval
  - secure thread clear (`DELETE`) for the current case thread (or explicit global scope)
- Chat file upload path uses the same async document-analysis queue as `/client/analysis`.

---

## 11. Notifications

- Helper **`notifyAppointmentRequest`** and webhook paths insert user-facing **notifications** for payments and appointments (titles/bodies in code).

---

## 12. External services summary

| Service | Use |
|---------|-----|
| **Supabase** | Auth, Postgres, Storage, Realtime |
| **Stripe** | Consultation payments |
| **Groq** | Document analysis, judge simulation, license OCR, chat |

---

## 13. Suggested discussion topics for workflow refinement

Use these prompts when reviewing with another LLM or your team:

1. **Booking:** Should **`pending`** vs **`scheduled`** be unified once migration 016 is guaranteed everywhere?
2. **Payments:** Single path (Payment Intent vs Checkout) for consistency and webhook coverage?
3. **Disputes:** Should **`cases.status`** include **`disputed`**, or only **`case_disputes`** + badges? Should **`resolved`** disputes force a case status transition?
4. **Verification:** Is AI license match sufficient for auto-approve, or always human-in-the-loop?
5. **Judge simulation:** Should simulations be **logged** (audit, billing, rate limits)?
6. **Analysis:** Retention policy for documents; client vs case-level visibility.
7. **Completion vs attended:** Clear user-facing copy for **`attended`** appointment vs **`completed`** case.

---

## 14. File map (starting points)

| Area | Location |
|------|----------|
| Book appointment | `components/lawyer/book-appointment-modal.tsx` |
| Client appointments / pay | `app/client/appointments/page.tsx` |
| Lawyer appointments | `app/lawyer/appointments/page.tsx` |
| Stripe | `app/api/stripe/*`, `components/payments/*` |
| Analyze document | `app/api/analyze-document/route.ts`, `app/client/analysis/page.tsx` |
| Judge simulation | `app/api/judge-simulation/route.ts`, `components/ai/judge-simulation-view.tsx` |
| License verify | `app/api/lawyer/verify-license/route.ts` |
| Disputes | `components/cases/dispute-modal.tsx`, `app/admin/disputes/page.tsx` |
| Admin lawyers | `app/admin/lawyers/page.tsx` |

---

*Generated from codebase review. Update this file when flows change.*
