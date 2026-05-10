# WiseCase — Implementation vs GPT Architecture Plan

This file tracks **what we adopted**, **what differs**, and **what is deferred** so production stays stable while evolving toward a **case-centric, workflow-driven** model.

---

## Phase 1 (implemented — SQL `scripts/043_phase1_case_centric_foundation.sql`)

| GPT suggestion | What we did |
|----------------|-------------|
| Case-centric core (`case_id`) | **Reinforced:** `case_timeline_events` + `case_drafts`; appointments/payments reference `case_id`. |
| Replace `sessionStorage` with drafts | **`case_drafts`** + **upsert after analysis** in `/api/analyze-document`. |
| Disputes separate from `cases.status` | **`DisputeModal`** does not force `cases.status = 'disputed'` when constrained; disputes live in **`case_disputes`**. |
| Analysis metadata | **`document_analysis`**: confidence, language, timing, model version. |
| Low-confidence behaviour | API returns **`lowConfidence`** and can skip recommendations when confidence &lt; 0.5. |
| Prompt-injection awareness | Integrity guidance in prompt + **`scanDocumentTextForInjection`** + **`ai_security_logs`**. |
| Timeline | **`case_timeline_events`** + **`appendCaseTimelineEvent`**. |
| Trust score | **`lawyer_profiles.trust_score`** + recompute after admin approve. |
| Stripe Checkout metadata | **`payments.stripe_checkout_session_id`** when creating Checkout Session (043). |
| Judge simulation wording | Stress-test / perspective language (not “prediction”). |

---

## Phase 2 — Workflow (implemented in app + partial DB hardening)

**Goal:** Persistent workflow state, real timeline as narrative, drafts replacing brittle browser-only state, consultation lifecycle events end-to-end.

| Area | Status | Notes |
|------|--------|--------|
| **`case_drafts` in booking** | Done | `BookAppointmentModal` loads draft, prefers **`linked_document_id`** over `sessionStorage`. |
| **Reduce `sessionStorage`** | Mostly done | Analysis page no longer writes `active_analysis_*`; booking keeps optional summary read fallback. |
| **Timeline on case detail** | Done | Client + lawyer **`/cases/[id]`** read **`case_timeline_events`** (not mocked feeds). |
| **Stripe / payment timeline** | Done | Webhook + verify paths append **`PAYMENT_COMPLETED`**, **`CASE_ACTIVATED`** where wired. |
| **Consultation lifecycle events** | Done | Includes **`CONSULTATION_ATTENDED`**, client cancel, lawyer accept/reject/cancel/reschedule, label helpers in **`lib/case-timeline.ts`**. |
| **Lawyer appointments UX** | Done | Accept/reject/cancel/reschedule with overlap checks + notifications + timeline. |
| **Dashboard client-requests widget** | Parity | **`client-requests.tsx`** now writes the same timeline events as the full appointments page and frees the case on reject (aligned with lawyer flow). |
| **DB status transition guard** | **Run SQL** | **`scripts/044_appointments_status_transition_guard.sql`** — blocks impossible jumps (e.g. terminal → active). Apply in Supabase after **042**. |

### Explicitly still deferred in Phase 2 scope

| Item | Why |
|------|-----|
| Rename DB enums (`pending` → `requested`, …) | Requires migration + full UI/webhook sweep (044 deliberately keeps existing status strings). |
| Timeline = only source of truth for every field | Some UI still reads **`appointments`** / **`cases`** directly (by design for operational screens). |

---

## Phase 3 — AI (implemented)

| Goal | Status |
|------|--------|
| Background/async analysis queue | **`document_analysis_jobs`** + **`POST /api/analyze-document`** with **`{ async: true }`** → **`GET /api/analyze-document/job/[jobId]`** (lazy worker on poll) + **`GET /api/cron/process-analysis-jobs`** (Bearer **`CRON_SECRET`** or Vercel **`x-vercel-cron`**). Run SQL **`scripts/045_document_analysis_jobs.sql`**. Requires **`SUPABASE_SERVICE_ROLE_KEY`** on the server for workers. |
| Admin dashboards for **`ai_security_logs`** | **`/admin/security-logs`** (latest 200 rows; **`AdminHeader`** link). |

---

## Phase 4 — Unified case workspace (UX; implemented)

| Goal | Status |
|------|--------|
| Role-aware **`/cases/[id]`** tab shell (Overview, Timeline, Documents, Appointments, Messages) | Done on **`app/client/cases/[id]/page.tsx`** and **`app/lawyer/cases/[id]/page.tsx`**. |
| Single route for both roles | Still separate **`/client/cases/[id]`** and **`/lawyer/cases/[id]`** (acceptable; unify later if desired). |

---

## Phase 5 — Chat hardening (implemented in app; migration required)

| Goal | Status |
|------|--------|
| Async analysis from chatbot upload flow | Done — `components/chatbot/Chat.tsx` now queues analysis (`async: true`) and polls job status. |
| Case-scoped AI chat history | App/API done — `case_id` is now written and history can be filtered by case context. Run SQL **`scripts/046_ai_chat_messages_case_scope.sql`**. |
| Chat history controls | Done — `/api/chat/history` now supports pagination (`limit`, `before`) and secure thread clear (`DELETE`) with case-access validation. |
| API abuse guard (lightweight) | Done — in-memory per-window throttles on `/api/chat` and `/api/analyze-document/job/[jobId]` return `429` + `Retry-After` when spamming. |

---

## Explicitly deferred (same as before — would break or duplicate behaviour)

| GPT suggestion | Why deferred |
|----------------|--------------|
| Rename case statuses → `draft`, `active`, … | Data migration + UI + triggers (**039/042** family). |
| Rename appointment statuses | **`awaiting_payment`**, **`pending`**, **`attended`** baked into Stripe + UI — phased rename only. |
| Remove **`verify-payment`** | Checkout return fallback until webhook-only is proven in prod. |
| Stripe **only** Checkout | Payment Intent path still exists — retire intentionally. |
| **`ai_chat_messages`** → case-scoped | Separate migration from **`messages`**. |

---

## SQL execution order (authoritative)

After **`040`–`042`** and **`043`**:

```text
scripts/043_phase1_case_centric_foundation.sql
scripts/044_appointments_status_transition_guard.sql
scripts/045_document_analysis_jobs.sql
scripts/046_ai_chat_messages_case_scope.sql
```

Run **`044` in the Supabase SQL Editor** on each environment (staging first). It adds a **BEFORE UPDATE OF status** trigger on **`appointments`** so invalid lifecycle jumps fail at the database.

Run **`045`** to create **`document_analysis_jobs`** (async analysis queue). Required for **`async: true`** uploads on **`/client/analysis`**.
Run **`046`** to add **`case_id`** context to **`ai_chat_messages`** (Phase 5 case-scoped chat history).

---

## Architecture shift summary

| Before | After (current) |
|--------|------------------|
| Feature pages + mocked activity | **Case-centric data** + **event timeline** on case detail |
| Browser-only analysis → booking link | **Drafts + document linkage** with optional legacy fallback |
| Status-only consultation story | **Explicit events** (accept, reject, cancel, reschedule, attended, payment) |

**Remaining for a full-parity polish pass:** optional enum renames, **`messages`** fully case-scoped in DB, and retiring legacy payment paths when you schedule a dedicated migration sprint.

---

*Last updated: Phase 3 async analysis + admin security logs + Phase 4 case workspace tabs + 045 documented.*
