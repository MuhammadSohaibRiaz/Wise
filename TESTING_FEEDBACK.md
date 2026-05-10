# WiseCase FYP — testing feedback tracker

Last updated: 2026-05-10 (continued)  
Use this file to track fixes from QA. Status: **done** | **partial** | **pending**

---

## Critical bugs

| # | Issue | Status |
|---|--------|--------|
| C1 | Client **My Cases** crashes: Supabase realtime `cannot add postgres_changes callbacks ... after subscribe()` | **done** |
| C2 | **Destructive toasts** show as solid red block (no readable text) in light theme | **done** |
| C3 | After Stripe payment, **appointment** row set to `completed` instead of **`scheduled`** (cases vs appointments mismatch, dashboard “next” empty) | **done** |
| C4 | **Client settings** profile photo: unstable `useEffect` deps (`createClient()` every render) breaking load/save | **done** |

## Navigation & loading UX

| # | Issue | Status |
|---|--------|--------|
| N1 | Global **progress bar** for auth, sidebar, and slow navigations | **done** (`RootProgressBar` + starts on internal link **pointerdown**; duplicate bar removed from `lawyer/layout`) |
| N2 | Chatbot route buttons — loading should feel smooth | **done** (same top bar + history loading state) |

## Chatbot

| # | Issue | Status |
|---|--------|--------|
| B1 | “Check missing profile” message then **no follow-up** | **done** (`stopWhen: stepCountIs(8)` so tool calls can continue; client missing fields include profile photo) |
| B2 | Reopen widget: **empty history for 2–3s** | **done** (loading state until history applied) |
| B3 | **Lawyer name** search → Groq `failed_generation` / stuck “Thinking” | **done** (`searchLawyers` scoring + Zod on empty tools; `searchReviews` uses `reviewee_id`; `getCaseAnalysisSummary` avoids fragile embed; UI **View Profile** from `searchLawyers` + hide spinner when last line is an error) |

## Client — cases, reviews, settings

| # | Issue | Status |
|---|--------|--------|
| S1 | **Reviews** page error toast unreadable | **done** (same as C2) |
| S2 | **Profile picture** not persisting / red errors | **done** (C4 + toast visibility) |
| S3 | Explain **multiple cases** without lawyer (“AI Analysis Documents” etc.) | **done** (short explainer on `/client/cases` when any cases exist) |
| S4 | **Rejected** consultation should reflect on client cases | **done** (lawyer reject clears `lawyer_id`, resets case to `open`) |

## Messages

| # | Issue | Status |
|---|--------|--------|
| M1 | **Duplicate inbox** rows for same lawyer | **done** (dedupe by counterparty id) |
| M2 | **Paperclip disabled** | **done** (upload to `avatars` under `attachments/…`, send link in message) |
| M3 | Message lawyer **before acceptance** — confusing errors | **done** (composer locked + clear toasts; destructive text now readable) |

## Lawyer UI

| # | Issue | Status |
|---|--------|--------|
| L1 | **Duplicate sidebars** on dashboard | **done** |
| L2 | **Duplicate sidebar** on appointments page | **done** |
| L3 | Success **toast does not auto-dismiss** | **done** (Radix `duration` on `Toast`) |
| L4 | New appointment **INSERT** not in realtime → had to refresh | **done** |
| L5 | **My Cases** list + case detail: duplicate sidebar, realtime `after subscribe()`, case load failing without `private_notes` column | **done** (sidebar only in `lawyer/layout`; unique channel id; retry select without notes; desktop sidebar scroll) |

## Disputes (real-world flow)

| Step | Where | What happens |
|------|--------|----------------|
| 1 | **`/client/cases/[id]`** | Client uses **Raise dispute** (modal) while the case is in progress or when completion is contested — inserts into **`case_disputes`** (script **033**). |
| 2 | **`/admin/disputes`** | Admin sees open disputes, reads reason/description, marks **resolved** (and optional admin notes). |
| 3 | Case status | Dispute does **not** auto-flip case status today; admin or parties resolve in the app + offline. Extend later if you want `cases.status = 'disputed'`. |

## Notifications

| # | Issue | Status |
|---|--------|--------|
| O1 | Click appointment notification → **does not open appointments** | **done** (dropdown items navigate by `type`) |

## Document analysis

| # | Issue | Status |
|---|--------|--------|
| D1 | Non-legal doc: prefer **toast** + less fake risk/urgency noise | **done** (neutral `N/A` fields + no analysis push notification; client can toast from response `isLegalDocument` if desired) |
| D2 | Same file → **inconsistent** risk/urgency | **done** (non-legal deterministic; text-mode Groq call now uses `temperature: 0`) |

## Payments & dashboard stats

| # | Issue | Status |
|---|--------|--------|
| P1 | **Active consultations** count inflated (all `open` cases) | **done** (count cases with `lawyer_id` set) |
| P2 | **Next appointment / total spent** after payment | **done** (appointment → `scheduled` after pay; dashboard query already matched) |

## Booking & availability

| # | Issue | Status |
|---|--------|--------|
| A1 | **Whole day** blocked after one booking (lawyer calendar) | **done** (day no longer fully disabled; slot picker already per-slot) |
| A2 | Modal should treat **awaiting_payment** as blocking the slot | **done** |

## Larger product work (X1–X3) — what it meant & how to finish

| # | Meaning | App (already in repo) | Database |
|---|--------|------------------------|----------|
| **X1** | Lawyer requests **completion** → client **confirms**, **declines** (back to in progress), or **raises dispute** (admin `case_disputes` from script 033) | Lawyer case detail: request completion → `pending_completion`. Client case detail: confirm, **Decline request** (new), dispute modal, review modal after confirm. | Run **`scripts/039_case_completion_workflow.sql`** — adds `completion_requested_*` metadata + stamps/clears them on status transitions. |
| **X2** | After **completed**, prompt for **review** | **Client dashboard** already opens `PendingCaseReviewDialog` when there is a completed case with a lawyer and **no review** yet. Case detail has **Share Review**. | No extra table required (`reviews` from script 008). |
| **X3** | **Appointments** should match **case** when the case is closed completed | Client confirm completion already updates `cases`. | **039** adds a trigger: when `cases.status` → `completed`, related `appointments` in `pending` / `awaiting_payment` / `scheduled` / `rescheduled` → `completed`. |

### Run order in Supabase SQL Editor

1. If you never ran **029**, run it first (adds `pending_completion` on cases).  
2. Run **`scripts/039_case_completion_workflow.sql`** once (idempotent).  
3. Run **`scripts/040_cases_private_notes.sql`** if lawyer case detail should persist **private notes**.  
4. Run **`scripts/041_fix_appointments_completed_while_case_active.sql`** to repair **future** appointments still marked `completed` while the case is active (supersedes the ad-hoc snippet below).  
5. Run **`scripts/042_appointments_attended_status.sql`** — adds **`attended`** (“consultation held”) vs **`completed`** on appointments (“closed with case” / trigger from 039). Migrates bad legacy `completed` rows on active cases.

After **039** + **042**, X1/X3 and appointment semantics align; admin dispute handling remains as in script **033**.

---

## Optional DB cleanup (Supabase SQL)

Prefer **`scripts/041_fix_appointments_completed_while_case_active.sql`** (joins `cases` so only wrong rows are touched). The snippet below is a looser legacy variant:

```sql
update public.appointments
set status = 'scheduled', updated_at = now()
where status = 'completed'
  and scheduled_at > now()
  and id in (select id from public.appointments where scheduled_at > now());
```

Adjust the `where` clause to match rows you intend to fix.
