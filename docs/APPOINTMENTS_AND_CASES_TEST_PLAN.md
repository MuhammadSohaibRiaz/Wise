# WiseCase — Appointments & Case Completion Test Plan

**Scope:** Reschedule UX, consultation held, no-show, slot availability, case outcome, success rate, admin cancellation, regressions.

**Prerequisites (run once in Supabase, in order):**
1. `scripts/057_add_case_outcome.sql`
2. `scripts/058_add_cancellation_request_message.sql`
3. `scripts/059_recompute_lawyer_success_from_cases.sql`

**Test accounts needed:**
| Role | Purpose |
|------|---------|
| Client A | Books, reschedules, confirms completion |
| Client B | Second client (slot conflict tests) |
| Lawyer L | Accepts, reschedules, marks held, requests completion |
| Lawyer L2 | Optional — overlap on different lawyer calendar |
| Admin | Cancellation request review |

**Convention:**
- **P** = Preconditions  
- **S** = Steps  
- **E** = Expected result  
- 🔴 = Must pass before release  
- 🟡 = Edge / negative  

---

## 0. Environment & data setup

### TC-0.1 — SQL migrations applied 🔴
| | |
|---|---|
| **P** | Fresh or existing DB |
| **S** | Run 057, 058, 059 in order |
| **E** | `cases.case_outcome` exists; `appointments.cancellation_request_message` exists; `recompute_lawyer_success_from_cases()` exists; `recompute_lawyer_rating()` does **not** update `success_rate` |

### TC-0.2 — Seed lawyer with known stats 🟡
| | |
|---|---|
| **P** | Lawyer L with 0 completed cases |
| **S** | View public profile, match card, dashboard |
| **E** | Success shows **"No cases yet"** everywhere |

### TC-0.3 — Seed lawyer with completed outcomes 🔴
| | |
|---|---|
| **P** | Lawyer L with 4 completed cases: 2 won, 1 settled, 1 lost |
| **S** | Run `SELECT recompute_lawyer_success_from_cases('<lawyer_id>');` or complete cases via UI |
| **E** | `success_rate` = 75% (3/4); `total_cases` = 4 |

---

## 1. Reschedule label

**Applies to:** `/client/appointments`, `/lawyer/appointments`  
**Appointment status:** `scheduled` or `rescheduled`, paid, >2h before slot.

### TC-1.1 — Count 0: plain "Reschedule" 🔴
| | |
|---|---|
| **P** | `reschedule_count = 0` |
| **S** | Open appointments list (client and lawyer) |
| **E** | Button text: **Reschedule** (no number). Modal hint has **no** “remaining” text |

### TC-1.2 — Count 1: "Reschedule (2 left)" 🔴
| | |
|---|---|
| **P** | `reschedule_count = 1` |
| **S** | View button; open reschedule modal |
| **E** | Button: **Reschedule (2 left)**. Modal: **(2 reschedules remaining)** |

### TC-1.3 — Count 2: "Reschedule (1 left)" 🔴
| | |
|---|---|
| **P** | `reschedule_count = 2` |
| **S** | View button |
| **E** | Button: **Reschedule (1 left)** |

### TC-1.4 — Count 3: no button, max message 🔴
| | |
|---|---|
| **P** | `reschedule_count = 3`, status `scheduled` or `rescheduled` |
| **S** | View actions |
| **E** | No Reschedule button. Message: *Maximum reschedules reached…* + **Contact Support** link |

### TC-1.5 — Within 2 hours: reschedule hidden 🟡
| | |
|---|---|
| **P** | `reschedule_count = 0`, appointment in 1 hour |
| **S** | View actions |
| **E** | No Reschedule button (not max message unless count ≥ 3) |

### TC-1.6 — Mark held still enabled at max reschedules 🔴
| | |
|---|---|
| **P** | `reschedule_count = 3`, within 7-day early window |
| **S** | Check **Mark Consultation Held** |
| **E** | Button **enabled** (reschedule limit does not block mark held) |

### TC-1.7 — Successful reschedule increments count 🔴
| | |
|---|---|
| **P** | `reschedule_count = 0` |
| **S** | Reschedule to valid slot; refresh |
| **E** | `reschedule_count = 1`; label updates to **(2 left)** |

### TC-1.8 — API rejects 4th reschedule 🟡
| | |
|---|---|
| **P** | `reschedule_count = 3` |
| **S** | Call `POST /api/appointments/reschedule` directly (Postman) |
| **E** | 400 with max-reschedule error |

---

## 2. Consultation held dialog

**Both roles:** client + lawyer appointment pages.

### TC-2.1 — Dialog opens on click 🔴
| | |
|---|---|
| **P** | Status `scheduled`, within 7 days before start |
| **S** | Click **Mark Consultation Held** (client + lawyer) |
| **E** | Dialog: *Consultation Complete?* with **Yes, proceed with case** and **No, close the case** |

### TC-2.2 — Yes, proceed → attended + in_progress 🔴
| | |
|---|---|
| **P** | Case status `open`; consultation `scheduled` |
| **S** | **Yes, proceed with case** |
| **E** | Appointment → `attended`. Case → `in_progress`. Timeline: consultation attended (+ case activated if was open). No review prompt yet |

### TC-2.3 — No, close → attended + closed 🔴
| | |
|---|---|
| **P** | Case `open` or `in_progress` |
| **S** | **No, close the case** |
| **E** | Appointment → `attended`. Case → `closed`. **No** review modal on case page |

### TC-2.4 — No review after close-from-held 🟡
| | |
|---|---|
| **P** | TC-2.3 completed |
| **S** | Open `/client/cases/[id]` |
| **E** | Status closed; no “Leave a review” / completed review CTA |

### TC-2.5 — Too early (>7 days before) 🟡
| | |
|---|---|
| **P** | Appointment 10 days in future |
| **S** | Try mark held (UI + API) |
| **E** | UI: button disabled, tooltip about 7-day window. API: 400 |

### TC-2.6 — Wrong status 🟡
| | |
|---|---|
| **P** | Status `pending`, `awaiting_payment`, `attended`, `cancelled` |
| **S** | No mark-held action visible |
| **E** | Actions not shown for non-scheduled/rescheduled |

### TC-2.7 — Other party cannot mark from wrong account 🟡
| | |
|---|---|
| **P** | Appointment for Client A + Lawyer L |
| **S** | Sign in as unrelated user; POST mark-attended |
| **E** | 403 Forbidden |

### TC-2.8 — Double submit idempotency 🟡
| | |
|---|---|
| **P** | Already `attended` |
| **S** | POST mark-attended again |
| **E** | 400 — cannot mark from current status |

---

## 3. No-show

### TC-3.1 — Button hidden before slot ends 🔴
| | |
|---|---|
| **P** | Appointment in 2 hours (or in progress) |
| **S** | Client + lawyer appointment pages |
| **E** | **Report No-Show** **not** visible |

### TC-3.2 — Button visible after slot ends 🔴
| | |
|---|---|
| **P** | `scheduled_at + duration` in the past; status `scheduled` or `rescheduled` |
| **S** | Refresh pages |
| **E** | **Report No-Show** visible (client + lawyer) |

### TC-3.3 — No-show cancels appointment + closes case 🔴
| | |
|---|---|
| **P** | TC-3.2 |
| **S** | Click **Report No-Show** |
| **E** | Appointment → `cancelled`. Case → `closed`. Toast confirms. Timeline: no-show event |

### TC-3.4 — API before slot end 🟡
| | |
|---|---|
| **P** | Slot not ended |
| **S** | POST `/api/appointments/mark-no-show` |
| **E** | 400 — only after scheduled time |

### TC-3.5 — No-show after mark held 🟡
| | |
|---|---|
| **P** | Already `attended` |
| **S** | Look for no-show button |
| **E** | Not available (wrong status) |

### TC-3.6 — Admin notified 🟡
| | |
|---|---|
| **P** | Admin user exists |
| **S** | Mark no-show; check admin notifications |
| **E** | Admin receives in-app notification about no-show |

---

## 4. Slot availability

### TC-4.1 — Booking: partial day selectable 🔴
| | |
|---|---|
| **P** | Lawyer L has one booking 10:00–11:00 on Day D |
| **S** | Client opens book modal; select Day D |
| **E** | Day D **selectable** on calendar (not fully disabled). Time dropdown **excludes** overlapping slots only |

### TC-4.2 — Booking: fully booked day disabled 🔴
| | |
|---|---|
| **P** | Lawyer L: every 30-min slot 9:00–18:00 blocked on Day F (use multiple appointments or long durations) |
| **S** | Open book modal |
| **E** | Day F **disabled** on calendar. Cannot select |

### TC-4.3 — Booking: duration change refreshes slots 🟡
| | |
|---|---|
| **P** | Day D with afternoon free |
| **S** | Select 30 min → note slots; switch to 90 min |
| **E** | Fewer slots; fully-booked days set may grow |

### TC-4.4 — Client reschedule: dynamic slots 🔴
| | |
|---|---|
| **P** | Paid appointment; `reschedule_count < 3` |
| **S** | Reschedule → pick date |
| **E** | Loading spinner; only free slots in dropdown (not static list) |

### TC-4.5 — Lawyer reschedule: no static TIME_SLOTS 🔴
| | |
|---|---|
| **P** | Same as TC-4.4 on lawyer page |
| **S** | Reschedule modal |
| **E** | Same dynamic behavior as client |

### TC-4.6 — Reschedule fully booked day disabled 🔴
| | |
|---|---|
| **P** | Day G fully booked for lawyer |
| **S** | Client/lawyer reschedule calendar |
| **E** | Day G disabled |

### TC-4.7 — Race: two clients same slot 🟡
| | |
|---|---|
| **P** | One slot left on Day D |
| **S** | Client A and B both select same time; submit booking seconds apart |
| **E** | One succeeds; second gets conflict error (no double booking) |

### TC-4.8 — Reschedule excludes current appointment 🟡
| | |
|---|---|
| **P** | Rescheduling apt at 14:00 |
| **S** | Pick same day; view slots |
| **E** | 14:00 slot **available** (current apt excluded from conflict) |

### TC-4.9 — Today: past times hidden 🟡
| | |
|---|---|
| **P** | Book/reschedule for today, afternoon |
| **S** | Open time list morning vs afternoon |
| **E** | Morning past slots not listed |

### TC-4.10 — Timezone sanity (local calendar) 🟡
| | |
|---|---|
| **P** | User not UTC; appointment stored UTC evening = local next day |
| **S** | Compare calendar disabled day vs DB `scheduled_at` |
| **E** | Fully-booked day matches **local** date, not off by one |

---

## 5. Case outcome dialog

**Page:** `/client/cases/[id]` when `pending_completion`.

### TC-5.1 — Dialog on confirm click 🔴
| | |
|---|---|
| **P** | Lawyer requested completion; status `pending_completion` |
| **S** | Click **Confirm Completion** |
| **E** | Outcome dialog opens (not immediate complete) |

### TC-5.2 — Four options present 🔴
| | |
|---|---|
| **S** | View dialog |
| **E** | Won, Lost, Settled, Ongoing (exact copy per spec) |

### TC-5.3 — Cannot confirm without selection 🔴
| | |
|---|---|
| **S** | Open dialog; click **Confirm** without selecting |
| **E** | Confirm button disabled |

### TC-5.4 — Won outcome 🔴
| | |
|---|---|
| **S** | Select **Won** → Confirm |
| **E** | Case `completed`, `case_outcome = won`. Outcome badge on case page. Review modal opens (if not reviewed) |

### TC-5.5 — Lost outcome 🔴
| | |
|---|---|
| **S** | Select **Lost** → Confirm |
| **E** | `case_outcome = lost`. Success rate excludes from wins |

### TC-5.6 — Settled outcome 🔴
| | |
|---|---|
| **S** | Select **Settled** → Confirm |
| **E** | `case_outcome = settled`. Counts toward success rate (won + settled) |

### TC-5.7 — Ongoing outcome 🔴
| | |
|---|---|
| **S** | Select **Ongoing** → Confirm |
| **E** | Case still `completed` with `ongoing` (per plan). Lawyer notified |

### TC-5.8 — Decline still works (no outcome) 🔴
| | |
|---|---|
| **P** | `pending_completion` |
| **S** | Click **Decline** (not Confirm) |
| **E** | Case → `in_progress`. No outcome dialog. No completion |

### TC-5.9 — API validation 🟡
| | |
|---|---|
| **S** | POST `/api/cases/{id}/complete` with `case_outcome: "invalid"` |
| **E** | 400 |

### TC-5.10 — Non-client forbidden 🟡
| | |
|---|---|
| **S** | Lawyer POST complete API |
| **E** | 403 |

### TC-5.11 — Wrong status 🟡
| | |
|---|---|
| **P** | Case `in_progress` |
| **S** | POST complete API |
| **E** | 400 — only `pending_completion` |

### TC-5.12 — Lawyer sees outcome 🔴
| | |
|---|---|
| **P** | TC-5.4 done |
| **S** | Lawyer opens `/lawyer/cases/[id]` |
| **E** | Shows client outcome label |

### TC-5.13 — Stale completion request 🟡
| | |
|---|---|
| **P** | Two tabs: lawyer declines while client has dialog open |
| **S** | Client confirms outcome |
| **E** | 409 or error — no longer pending |

---

## 6. Success rate display

### TC-6.1 — Zero completed cases 🔴
| | |
|---|---|
| **P** | Lawyer L, 0 completed |
| **S** | Check: match `LawyerCard`, `/client/lawyer/[id]`, lawyer dashboard header, profile preview |
| **E** | **No cases yet** (not 0%, not N/A) |

### TC-6.2 — Percentage display 🔴
| | |
|---|---|
| **P** | 4 completed: 2 won, 1 settled, 1 lost |
| **S** | View same surfaces |
| **E** | **75% success rate** (or rounded per UI) |

### TC-6.3 — Formula after new completion 🔴
| | |
|---|---|
| **P** | Lawyer at 75% (3/4) |
| **S** | Complete new case with outcome **won** |
| **E** | Rate → 80% (4/5). `total_cases` = 5 |

### TC-6.4 — Review does not change success rate 🔴
| | |
|---|---|
| **P** | Known success rate before review |
| **S** | Client submits 5-star review |
| **E** | `average_rating` updates; **success_rate unchanged** |

### TC-6.5 — DB trigger on outcome change 🟡
| | |
|---|---|
| **P** | Completed case; lawyer at known rate |
| **S** | Admin/SQL: change `case_outcome` from `lost` to `won` (if allowed) |
| **E** | `recompute_lawyer_success_from_cases` runs; rate increases |

### TC-6.6 — Analysis page lawyer cards 🟡
| | |
|---|---|
| **P** | AI recommendations on `/client/analysis` |
| **S** | View card success field |
| **E** | Shows **No cases yet** when stats not in payload (known limitation) |

---

## 7. Admin cancellation message

### TC-7.1 — Message stored on submit 🔴
| | |
|---|---|
| **P** | Paid `scheduled` appointment |
| **S** | Client or lawyer: Contact Support; message ≥20 chars |
| **E** | Status `cancellation_requested`. DB: `cancellation_request_message` populated |

### TC-7.2 — Message shown in admin UI 🔴
| | |
|---|---|
| **P** | TC-7.1 |
| **S** | Admin → `/admin/cancellation-requests` |
| **E** | **Request message** section shows full text |

### TC-7.3 — Short message rejected 🟡
| | |
|---|---|
| **S** | Submit support ticket with <20 chars |
| **E** | UI validation + API 400 |

### TC-7.4 — Approve cancellation 🔴
| | |
|---|---|
| **P** | Pending request |
| **S** | Admin approve |
| **E** | Request removed from list; client/lawyer emails/notifications per existing flow |

### TC-7.5 — Reject cancellation 🔴
| | |
|---|---|
| **S** | Admin reject with reason |
| **E** | Appointment returns to scheduled; parties notified |

---

## 8. Regression — core flows unchanged

### TC-8.1 — End-to-end booking 🔴
| | |
|---|---|
| **S** | Match → book → lawyer accept → client pay (Stripe) → `scheduled` |
| **E** | Full path works; payment webhook unchanged |

### TC-8.2 — Payment cancel redirect 🟡
| | |
|---|---|
| **S** | Start checkout; cancel |
| **E** | Returns to appointments; `awaiting_payment` |

### TC-8.3 — Reschedule under limit 🔴
| | |
|---|---|
| **S** | Reschedule once; both parties see new time |
| **E** | Status `rescheduled`; emails/notifications if configured |

### TC-8.4 — Lawyer requests completion → client confirms 🔴
| | |
|---|---|
| **S** | Mark held → in_progress → lawyer requests completion → client outcome dialog → confirm |
| **E** | `completed` + outcome + review option |

### TC-8.5 — Review submission 🔴
| | |
|---|---|
| **P** | Case completed |
| **S** | Submit review from modal |
| **E** | Review saved; rating updates; success rate **not** from stars |

### TC-8.6 — RAG chatbot smoke 🔴
| | |
|---|---|
| **S** | Open legal assistant; ask platform question + legal question |
| **E** | Responds; tools/routing unchanged |

### TC-8.7 — Document analysis smoke 🔴
| | |
|---|---|
| **S** | Upload doc on `/client/analysis`; run analysis |
| **E** | Job completes; capacity messages friendly if limited |

### TC-8.8 — Messages & documents on case 🔴
| | |
|---|---|
| **S** | Open case messages tab; upload/view document |
| **E** | No regressions from appointment changes |

---

## 9. Cross-role & integration matrix

| Scenario | Client | Lawyer | Admin |
|----------|--------|--------|-------|
| Reschedule label | ✓ TC-1.x | ✓ TC-1.x | — |
| Mark held dialog | ✓ TC-2.x | ✓ TC-2.x | — |
| No-show | ✓ TC-3.x | ✓ TC-3.x | — |
| Outcome dialog | ✓ TC-5.x | view TC-5.12 | — |
| Cancel request | ✓ TC-7.x | ✓ TC-7.x | ✓ TC-7.x |
| Slot booking | ✓ TC-4.1–4.3 | — | — |

---

## 10. Quick smoke checklist (15 min)

- [ ] 057–059 SQL run  
- [ ] Reschedule label at count 0 and 2  
- [ ] Mark held → proceed → in_progress  
- [ ] No-show hidden before / visible after slot  
- [ ] Book: partial day has some times  
- [ ] Confirm completion → pick outcome → review modal  
- [ ] Success: 0 cases = "No cases yet"  
- [ ] Review: rating up, success % same  
- [ ] Admin: cancellation message visible  
- [ ] `npm run build` passes  

---

## Test data helpers (SQL snippets)

```sql
-- Set reschedule count for testing labels
UPDATE appointments SET reschedule_count = 2
WHERE id = '<appointment_id>';

-- Inspect success rate inputs
SELECT status, case_outcome FROM cases
WHERE lawyer_id = '<lawyer_id>' AND status = 'completed';

-- Verify cancellation message
SELECT id, status, cancellation_request_message
FROM appointments WHERE status = 'cancellation_requested';
```

---

## Defect log template

| ID | TC | Severity | Role | Steps | Actual | Expected |
|----|-----|----------|------|-------|--------|----------|
| | | P1/P2/P3 | | | | |

---

*Generated for WiseCase appointments UX implementation. Update TC IDs when adding automated tests.*
