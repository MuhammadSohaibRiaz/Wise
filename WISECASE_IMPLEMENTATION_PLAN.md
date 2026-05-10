# WiseCase implementation plan (chatbot, profiles, sync)

Living document to track work against product requests. Update checkboxes as items ship.

## 1. Chatbot navigation (correct URLs, lawyer vs client)

| Item | Status | Notes |
|------|--------|--------|
| Canonical route map (settings, dashboard, appointments, cases, analysis, auth) | ☑ | `lib/chat-routes.ts` |
| Server-side path normalization in `navigateToPage` tool | ☑ | `lib/ai/tools.ts` uses `normalizeChatNavigationPath` |
| System prompt / auth context includes **explicit role** (`client` vs `lawyer`) | ☑ | `/api/chat` loads `profiles.user_type` |
| Guest redirects: client sign-in vs lawyer sign-in when appropriate | ☑ | Prompt mentions both; normalization maps `/login` by role |
| Client `Chat.tsx`: normalize links + role-aware quick actions | ☑ | Loads role from Supabase; appointment presets name `/lawyer/` vs `/client/` paths |

## 2. Lawyer registration & profile

| Item | Status | Notes |
|------|--------|--------|
| Bar license saved to `lawyer_profiles.bar_license_number` | ☑ | Sync from `user_metadata` on profile load if DB empty |
| Primary practice area: **dropdown** aligned with `lawyer_profiles.specializations` | ☑ | `lib/specializations.ts` + lawyer register Select |
| Registration choice synced into DB specializations | ☑ | Same profile-load sync for `practice_area` metadata |
| **Years of experience** editable on `/lawyer/profile` | ☑ | Professional / rates section |
| Auth callback redirect by role | ☑ | `app/auth/callback/route.ts` uses `user_metadata.user_type` |

## 3. Client dashboard (real data)

| Item | Status | Notes |
|------|--------|--------|
| Recent notifications from `notifications` table | ☑ | `app/client/dashboard/page.tsx` + Realtime `INSERT` |
| Recommended lawyers from latest **document analysis** | ☑ | `matchLawyersWithCategory(supabase, latest summary)` |
| Remove hard-coded lawyer cards / notification copy | ☑ | Replaced with live data + empty states |

## 4. `/client/ai-recommendations`

| Item | Status | Notes |
|------|--------|--------|
| Match lawyers using case type + description (same matcher as analysis) | ☑ | `app/client/ai-recommendations/page.tsx` |
| Optional: persist “case intake” row | ☐ | Future: store for analytics; not required for MVP |

## 5. Ratings & post-case review

| Item | Status | Notes |
|------|--------|--------|
| Reviews table already exists (`scripts/008_create_reviews.sql`) | ☑ | — |
| Prompt client to review when case is `completed` and no review exists | ☑ | `PendingCaseReviewDialog` on client dashboard |
| Recompute `lawyer_profiles.average_rating` (and **success_rate** display) | ☑ | `lib/recompute-lawyer-stats.ts` after submit |
| Lawyer + client pages show consistent realtime review data | ☑ | Profile aggregates updated; reviews list polls on navigation |

## 6. Testing checklist

- [ ] Lawyer: quick action “Appointments” → `/lawyer/appointments` only  
- [ ] Client: same → `/client/appointments`  
- [ ] “Take me to settings” → `/lawyer/profile` (lawyer) or `/client/settings` (client)  
- [ ] New lawyer signup: bar number appears after first login  
- [ ] Dashboard notifications update when a new row is inserted (Stripe/webhook or test insert)  
- [ ] Completed case without review opens modal once  

*(Manual QA suggested — automation not added.)*

---

**Dependencies:** Supabase RLS unchanged for these flows; notification insert policies require `created_by = auth.uid()` (see `019_create_notifications.sql`).

**Last updated:** 2026-05-02
