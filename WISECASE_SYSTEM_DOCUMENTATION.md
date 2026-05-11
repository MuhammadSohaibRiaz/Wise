# WiseCase — Complete System Documentation

> **Last Updated:** May 11, 2026
> **Purpose:** Full-picture reference for onboarding AI assistants (Claude, GPT) and viva preparation.

---

## 1. PROJECT OVERVIEW

**WiseCase** is an AI-powered legal consultation platform built for **Pakistan**. It connects clients with verified lawyers, provides AI-driven document analysis, and manages the entire case lifecycle from initial consultation to completion and review.

**Target Users:** Pakistani citizens seeking legal help, and licensed Pakistani lawyers/advocates.

**Core Value Proposition:**
- AI analysis of legal documents using Llama-3.3-70B (via Groq)
- Smart lawyer matching based on document analysis
- End-to-end case management with appointment booking and payments
- AI chatbot for platform navigation and legal guidance
- AI Judicial Perspective Simulator for stress-testing legal arguments

---

## 2. TECH STACK

### Frontend
| Technology | Purpose |
|---|---|
| **Next.js 14** (App Router) | Full-stack React framework, SSR/SSG |
| **React 18** | UI library |
| **TypeScript 5** | Type safety |
| **Tailwind CSS 4** | Utility-first styling |
| **Shadcn/UI** (Radix primitives) | Component library (Dialog, Select, Tabs, Toast, etc.) |
| **Lucide React** | Icon library |
| **Framer Motion** | Animations |
| **React Hook Form + Zod** | Form handling and validation |
| **date-fns** | Date formatting |
| **React Markdown + remark-gfm** | Rendering AI chat responses |
| **Recharts** | Charts (admin dashboard) |
| **React Dropzone** | File upload zones |

### Backend / APIs
| Technology | Purpose |
|---|---|
| **Next.js API Routes** | Server-side endpoints (`app/api/`) |
| **Supabase** | Database (PostgreSQL), Auth, Storage, Realtime |
| **Supabase SSR** (`@supabase/ssr`) | Server-side Supabase client for Next.js |
| **Groq SDK + AI SDK** (`@ai-sdk/groq`, `ai`) | LLM integration (Llama-3.3-70B) |
| **Stripe** | Payment processing (checkout sessions, webhooks) |
| **pdf-parse** | PDF text extraction for document analysis |
| **Tesseract.js** | OCR for image-based documents |

### Infrastructure
| Technology | Purpose |
|---|---|
| **Vercel** | Hosting and deployment |
| **Supabase Cloud** | Managed PostgreSQL + Auth + Storage + Realtime |
| **Stripe** | Payment gateway (test mode) |

### Environment Variables Required
```
NEXT_PUBLIC_SUPABASE_URL          # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY     # Supabase anonymous key (public)
SUPABASE_ANON_KEY                 # Same anon key (server alias)
SUPABASE_SERVICE_ROLE_KEY         # Supabase service role key (server-only, bypasses RLS)
GROQ_API_KEY                      # Groq API key for Llama-3.3-70B
STRIPE_SECRET_KEY                 # Stripe secret key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY # Stripe publishable key
STRIPE_WEBHOOK_SECRET             # Stripe webhook signing secret
CRON_SECRET                       # Secret for cron job endpoints
NEXT_PUBLIC_SITE_URL              # Site URL for redirects
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL # Auth callback URL
```

---

## 3. USER ROLES

### Role 1: **Client**
- Registers via `/auth/client/register`
- Signs in via `/auth/client/sign-in`
- All client pages under `/client/*`
- Can: upload documents, get AI analysis, search lawyers, book appointments, pay via Stripe, manage cases, submit reviews, use AI chatbot, use Judicial Perspective Simulator

### Role 2: **Lawyer**
- Registers via `/auth/lawyer/register`
- Signs in via `/auth/lawyer/sign-in`
- All lawyer pages under `/lawyer/*`
- Must upload a **Bar License document** during registration
- Starts in **"pending verification"** state — cannot access platform features until admin verifies
- If rejected, sees a re-upload option
- Can: manage cases, accept/reject consultations, manage appointments, mark consultations as held, request case completion, use Judicial Perspective Simulator, manage profile

### Role 3: **Admin**
- Signs in via `/auth/admin/sign-in`
- All admin pages under `/admin/*`
- Protected by middleware: checks `profiles.user_type === 'admin'`
- Can: view dashboard stats, verify/reject lawyers, view all users, view AI security logs
- Disputes module currently **disabled**

### Authentication Flow
1. User registers with email/password via Supabase Auth
2. Supabase sends a confirmation email with a callback link
3. Callback hits `/auth/callback` which exchanges the code for a session
4. Middleware (`middleware.ts`) runs on every request:
   - Public routes: `/`, `/auth/*`, `/match`, `/terms`, `/privacy`, `/client/lawyer/*`
   - Non-public routes without session → redirect to `/auth/client/sign-in`
   - `/admin/*` routes → extra check that `user_type === 'admin'`
5. Client layout (`app/client/layout.tsx`) double-checks: session exists AND `user_type === 'client'`
6. Lawyer layout (`app/lawyer/layout.tsx`) double-checks: session exists AND `user_type === 'lawyer'`, also checks verification status

---

## 4. DATABASE SCHEMA (Supabase / PostgreSQL)

### Core Tables

| Table | Purpose |
|---|---|
| `profiles` | All users (clients, lawyers, admins). Fields: id, email, first_name, last_name, phone, bio, avatar_url, user_type, location, created_at |
| `lawyer_profiles` | Extended lawyer data. Fields: id (FK→profiles), specializations (text[]), hourly_rate, years_of_experience, bar_license_number, verified (bool), verification_status (pending/approved/rejected), average_rating, success_rate, total_cases, license_document_url |
| `cases` | Legal cases. Fields: id, title, description, status (open/in_progress/pending_completion/completed/closed), case_type, client_id, lawyer_id, hourly_rate, budget_min, budget_max, private_notes, created_at, updated_at |
| `appointments` | Consultation bookings. Fields: id, case_id, client_id, lawyer_id, scheduled_at, duration_minutes, status (pending/awaiting_payment/scheduled/rescheduled/attended/completed/cancelled/rejected), notes |
| `documents` | Uploaded files. Fields: id, case_id, uploaded_by, file_name, file_url, file_type, document_type, status, created_at |
| `document_analysis` | AI analysis results. Fields: id, document_id, summary, risk_level (Low/Medium/High), urgency, seriousness, recommendations, is_legal_document, analysis_status, created_at |
| `payments` | Stripe payments. Fields: id, case_id, client_id, amount, status (pending/completed/failed), stripe_session_id, created_at |
| `reviews` | Client reviews of lawyers. Fields: id, case_id, reviewer_id, reviewee_id, rating (1-5), comment, status (published/pending), created_at |
| `messages` | Direct messages between client and lawyer. Fields: id, case_id, sender_id, receiver_id, content, created_at, is_read |
| `notifications` | System notifications. Fields: id, user_id, created_by, type, title, description, data (jsonb), is_read, created_at |
| `ai_chat_messages` | Chatbot conversation history. Fields: id, user_id, case_id, role, content, metadata (jsonb), created_at |
| `case_timeline_events` | Audit trail for case lifecycle. Fields: id, case_id, actor_id, event_type, metadata (jsonb), created_at |
| `case_disputes` | Dispute records (module disabled). Fields: id, case_id, raised_by, reason, description, status, admin_notes, resolved_at |
| `certifications` | Lawyer certifications/portfolio items |
| `document_analysis_jobs` | Background job queue for async analysis |

### Key Database Triggers (SQL scripts)
| Script | Trigger/Function |
|---|---|
| `010_create_triggers.sql` | Auto-create profiles on auth.users insert |
| `014_auto_create_lawyer_profile.sql` | Auto-create lawyer_profiles row when profile.user_type = 'lawyer' |
| `044_appointments_status_transition_guard.sql` | Prevents invalid appointment status transitions |
| `047_require_attended_before_case_completion.sql` | Case cannot move to `pending_completion` unless at least one appointment has `attended` status |
| `048_auto_recompute_lawyer_rating.sql` | On review INSERT/UPDATE/DELETE, automatically recomputes lawyer's average_rating, success_rate, and total_cases (SECURITY DEFINER, bypasses RLS) |

### Row-Level Security (RLS)
- All tables have RLS enabled
- Users can only read/write their own data (client_id or lawyer_id matches auth.uid())
- Service role key bypasses RLS for admin operations and triggers
- The rating trigger uses SECURITY DEFINER to bypass RLS when updating lawyer_profiles

---

## 5. COMPLETE PAGE MAP

### Public Pages
| Route | Purpose |
|---|---|
| `/` | Landing page |
| `/match` | Browse/search lawyers (public profiles) |
| `/client/lawyer/[id]` | Public lawyer profile page |
| `/terms` | Terms of service |
| `/privacy` | Privacy policy |

### Auth Pages
| Route | Purpose |
|---|---|
| `/auth/client/sign-in` | Client login |
| `/auth/client/register` | Client registration |
| `/auth/lawyer/sign-in` | Lawyer login |
| `/auth/lawyer/register` | Lawyer registration (includes license upload) |
| `/auth/admin/sign-in` | Admin login |
| `/auth/forgot-password` | Password reset request |
| `/auth/reset-password` | Set new password |
| `/auth/callback` | OAuth/email callback handler |

### Client Pages (`/client/*`)
| Route | Purpose |
|---|---|
| `/client/dashboard` | Stats cards (active cases, payments, appointments), recommended lawyers, notifications feed, pending review dialog |
| `/client/cases` | List all cases with status badges, View/Message buttons |
| `/client/cases/[id]` | Case detail: progress stepper, overview, timeline, documents, appointments, messages. Shows confirm/decline banner when status = pending_completion. Review modal on completion. |
| `/client/analysis` | Upload documents for AI analysis, view analysis history, delete documents |
| `/client/appointments` | View/manage appointments, mark as held, cancel (pre-payment only) |
| `/client/messages` | Direct messaging with lawyers |
| `/client/payments` | Payment history |
| `/client/reviews` | View submitted reviews |
| `/client/settings` | Profile settings, avatar upload |
| `/client/judge-simulation` | AI Judicial Perspective Simulator |
| `/client/ai-recommendations` | AI-powered lawyer recommendations (page exists but hidden from dashboard) |

### Lawyer Pages (`/lawyer/*`)
| Route | Purpose |
|---|---|
| `/lawyer/dashboard` | Active cases, upcoming appointments, stats, earnings |
| `/lawyer/cases` | List all cases with tabs (Active/Completed/All) |
| `/lawyer/cases/[id]` | Case detail: status management dropdown, request completion banner, documents with AI analysis, appointments, billing, private notes |
| `/lawyer/appointments` | Manage appointment requests (accept/reject/reschedule) |
| `/lawyer/messages` | Direct messaging with clients |
| `/lawyer/profile` | Edit profile, specializations, hourly rate, experience |
| `/lawyer/profile/preview` | See public profile preview |
| `/lawyer/judge-simulation` | AI Judicial Perspective Simulator |

### Admin Pages (`/admin/*`)
| Route | Purpose |
|---|---|
| `/admin/dashboard` | Total users, verified lawyers, pending verifications, total cases stats |
| `/admin/lawyers` | Review pending lawyer verifications, approve/reject with document preview |
| `/admin/users` | View all registered users |
| `/admin/disputes` | **Disabled** — shows placeholder message |
| `/admin/security-logs` | View AI document analysis security scan logs |

---

## 6. API ROUTES

| Route | Method | Purpose |
|---|---|---|
| `/api/chat` | POST | AI chatbot — streams responses using Groq Llama-3.3-70B with tool calling |
| `/api/chat/history` | GET | Fetch user's chat history from `ai_chat_messages` |
| `/api/analyze-document` | POST | Upload and start AI document analysis (extracts text via pdf-parse/Tesseract, runs through security scanner, sends to Groq for analysis) |
| `/api/analyze-document/job/[jobId]` | GET | Poll analysis job status |
| `/api/judge-simulation` | POST | AI Judicial Perspective Simulator — sends legal arguments to Groq for stress-testing |
| `/api/appointments/mark-attended` | POST | Mark an appointment as "attended" (held) |
| `/api/stripe/create-checkout-session` | POST | Create a Stripe checkout session for appointment payment |
| `/api/stripe/create-payment-intent` | POST | Create a Stripe payment intent |
| `/api/stripe/verify-payment` | POST | Verify payment status after Stripe redirect |
| `/api/stripe/webhook` | POST | Handle Stripe webhook events (payment_intent.succeeded, checkout.session.completed) |
| `/api/lawyers/search` | GET | Search verified lawyers by name/specialty |
| `/api/lawyer/verify-license` | POST | Admin endpoint to approve/reject lawyer verification |
| `/api/cron/process-analysis-jobs` | POST | Cron job to process queued document analysis jobs |

---

## 7. DETAILED FEATURE FLOWS

### Flow 1: Client Registers and Finds a Lawyer

```
1. Client visits /auth/client/register
2. Fills in: first name, last name, email, password
3. Supabase Auth creates user → trigger creates profiles row (user_type: 'client')
4. Email confirmation sent → client clicks link → /auth/callback exchanges code for session
5. Client lands on /client/dashboard
6. Client can browse lawyers at /match (public, works without login too)
7. Search by name or specialization → results show cards with rating, location, specializations
8. Click "View Profile" → /client/lawyer/[id] shows full profile, reviews, "Book Consultation" button
```

### Flow 2: Lawyer Registers and Gets Verified

```
1. Lawyer visits /auth/lawyer/register
2. Fills in: name, email, password, specialization, experience, hourly rate
3. Uploads Bar License document (PDF/image) to Supabase Storage
4. Supabase Auth creates user → trigger creates profiles row (user_type: 'lawyer')
   → another trigger creates lawyer_profiles row (verified: false, verification_status: 'pending')
5. Lawyer signs in → /lawyer/layout.tsx detects verification_status
6. Shows "Verification Pending" blocking screen — cannot access dashboard/cases
7. Admin goes to /admin/lawyers → sees pending verification
8. Admin clicks "Review" → sees uploaded license document
9. Admin clicks "Approve" or "Reject"
   - Approve: verification_status → 'approved', verified → true
   - Reject: verification_status → 'rejected'
10. If rejected: lawyer sees red "Rejected" screen with "Re-upload Document" button
11. If approved: lawyer can now access all /lawyer/* pages
```

### Flow 3: Booking a Consultation (Appointment + Payment)

```
1. Client is on /client/lawyer/[id] (lawyer's public profile)
2. Clicks "Book Consultation"
3. Selects date/time and duration → appointment created with status: 'pending'
4. Notification sent to lawyer
5. Lawyer sees the request on /lawyer/appointments
6. Lawyer accepts → appointment status: 'awaiting_payment'
   (or rejects → status: 'rejected', notification to client)
7. Client sees "Awaiting Payment" on /client/appointments
8. Client clicks "Pay" → Stripe Checkout Session created via /api/stripe/create-checkout-session
9. Client pays on Stripe-hosted page → redirected back
10. Stripe webhook fires → /api/stripe/webhook processes payment
11. Payment recorded in `payments` table, appointment status: 'scheduled'
12. Notification sent to both parties
13. A `cases` row is created (or existing one linked) with status: 'open' → then 'in_progress'
```

### Flow 4: Conducting and Recording a Consultation

```
1. Appointment is 'scheduled' — both parties see it in their Appointments page
2. Consultation happens (outside the platform — video call, in-person, etc.)
3. After consultation, either party clicks "Mark Consultation Held"
   → /api/appointments/mark-attended validates:
     - Appointment must be 'scheduled'
     - Current time must be within 1 hour before or after scheduled_at
   → appointment status: 'attended'
   → Timeline event: CONSULTATION_ATTENDED
4. Case status remains 'in_progress'
5. Lawyer can now request case completion (requires at least one 'attended' appointment — enforced by DB trigger 047)
```

### Flow 5: Case Completion and Review

```
1. Lawyer goes to /lawyer/cases/[id]
2. Either uses the purple banner "Request Case Completion" button
   OR selects "Request Case Completion" from the Status Management dropdown
3. Case status changes to 'pending_completion'
4. Notification sent to client: "Lawyer has requested case completion"
5. Client opens /client/cases/[id] → sees purple banner:
   - "Confirm Completion" button
   - "Decline" button
6a. Client clicks "Confirm Completion":
   → Case status: 'completed'
   → Notification to lawyer: "Client confirmed completion"
   → Review modal pops up automatically after 500ms
   → Client submits star rating (1-5) + optional comment
   → Review inserted with status: 'published'
   → DB trigger (048) fires → recalculates lawyer's average_rating, success_rate, total_cases
   → Lawyer's public profile updated in real-time
6b. Client clicks "Decline":
   → Case status back to 'in_progress'
   → Notification to lawyer: "Client declined completion request"
   → Lawyer must continue working before requesting completion again
7. After completion, lawyer can "Archive Case" → status: 'closed'
```

### Flow 6: AI Document Analysis

```
1. Client goes to /client/analysis
2. Drops a file (PDF, JPG, PNG) into the upload zone
3. File uploaded to Supabase Storage
4. Document row created in `documents` table
5. POST /api/analyze-document triggered:
   a. Text extracted from document:
      - PDF → pdf-parse extracts text
      - Image → Tesseract.js OCR extracts text
   b. PRE-LLM SECURITY SCAN (lib/document-analysis-security.ts):
      - 30+ regex patterns across 8 attack categories scan for prompt injection
      - Categories: instruction override, prompt extraction, role play, config extraction,
        fake urgency, result manipulation, code injection, prompt stuffing
      - If high-severity injection detected → warning injected into LLM prompt
   c. Text sanitized: control characters stripped (lib/analysis/run-document-analysis.ts)
   d. Text sent to Groq Llama-3.3-70B with structured prompt:
      - Must determine if document is a legal document (is_legal_document: true/false)
      - If not legal → returns immediately with is_legal_document: false
      - If legal → returns: summary, risk_level (Low/Medium/High), urgency, seriousness,
        recommendations (array), key_clauses, applicable_laws
      - Scoring rubric embedded in prompt for consistency
   e. Response parsed and normalized (enum values normalized server-side)
   f. Results saved to `document_analysis` table
6. Client sees results: summary, risk level badge, urgency, recommendations list
7. History tab shows all past analyses with risk-level badges and delete option
8. Analysis data feeds into lawyer matching (recommended lawyers based on case type)
```

### Flow 7: AI Chatbot

```
1. Chatbot widget available on every page (bottom-right floating button)
2. User types a message → POST /api/chat
3. API flow:
   a. Rate limiting: 25 messages/minute/user
   b. User authentication checked (works for guests too, with limited features)
   c. System prompt loaded (lib/chatBotData.ts):
      - WiseCase Assistant identity
      - Pakistani law guardrails (no Indian law, no hallucinated sections)
      - Platform knowledge base
      - Page-awareness via [PAGE_CONTEXT]
      - Navigation markers: [ACTION:Label:/path] and [NAVIGATE:/path]
   d. User role detected → auth context injected (client routes vs lawyer routes)
   e. Groq Llama-3.3-70B called with streaming + tool calling
4. Available tools (lib/ai/tools.ts):
   - navigateToPage: Redirect user to a page
   - getProfileStatus: Check what profile fields are missing
   - updateProfile: Update profile fields via chat
   - getMyDataSummary: Fetch recent cases and appointments
   - searchLawyers: Search by name/specialty (returns UUID for profile links)
   - searchReviews: Fetch reviews for a lawyer
   - getPlatformFAQ: Answer platform policy questions
   - getCaseAnalysisSummary: Aggregate analysis across all documents in a case
5. If tool call fails → fallback to plain text response (no tools)
6. Messages saved to `ai_chat_messages` table for history
7. Chat history loadable via GET /api/chat/history
8. Chat supports thread management and delete functionality
```

### Flow 8: AI Judicial Perspective Simulator

```
1. Available at /client/judge-simulation and /lawyer/judge-simulation
2. User enters their legal arguments/case details in a form
3. POST /api/judge-simulation
4. Groq Llama-3.3-70B evaluates the arguments from a judicial perspective
5. Returns: strengths, weaknesses, potential judicial concerns, recommendations
6. Framed as "stress testing" — NOT prediction or outcome forecasting
7. Explicit disclaimers: educational only, not a substitute for court judgment
```

### Flow 9: Stripe Payment Flow

```
1. Client needs to pay for a scheduled appointment
2. Frontend calls POST /api/stripe/create-checkout-session
   - Sends: appointment_id, case_id, amount, lawyer info
3. API creates a Stripe Checkout Session with:
   - Line items (consultation fee)
   - Success/cancel URLs
   - Metadata (case_id, appointment_id, client_id)
4. Client redirected to Stripe-hosted payment page
5. After payment:
   a. Stripe sends webhook to /api/stripe/webhook
   b. Webhook verifies signature using STRIPE_WEBHOOK_SECRET
   c. On 'checkout.session.completed':
      - Creates payment record in `payments` table
      - Updates appointment status to 'scheduled'
      - Creates timeline event: PAYMENT_COMPLETED
      - Sends notifications to both parties
6. Client redirected back to app → /api/stripe/verify-payment confirms status
```

---

## 8. REAL-TIME FEATURES (Supabase Realtime)

| Page | Subscriptions |
|---|---|
| Client Dashboard | `notifications`, `cases`, `appointments`, `payments` tables — auto-refreshes on changes |
| Client Cases List | `cases` table changes for client_id |
| Lawyer Dashboard | `cases`, `appointments`, `notifications` for lawyer_id |
| Lawyer Cases List | `cases` table changes for lawyer_id |
| Messages | `messages` table — real-time chat between client and lawyer |
| Appointments | `appointments` table changes |

---

## 9. CASE LIFECYCLE (Status Machine)

```
┌──────────┐     ┌─────────────┐     ┌─────────────────────┐     ┌───────────┐     ┌────────┐
│   OPEN   │ ──→ │ IN_PROGRESS │ ──→ │ PENDING_COMPLETION  │ ──→ │ COMPLETED │ ──→ │ CLOSED │
└──────────┘     └─────────────┘     └─────────────────────┘     └───────────┘     └────────┘
  (created)       (lawyer assigned,      (lawyer requests,         (client          (lawyer
                   payment done)          needs attended            confirms)        archives)
                                          appointment — 
                                          enforced by DB
                                          trigger 047)
                                              │
                                              ↓ (client declines)
                                         back to IN_PROGRESS
```

### Visual Progress Stepper (8 stages derived from real data):
1. **Case Created** — case row exists
2. **Consultation Requested** — appointment in pending/awaiting_payment/scheduled
3. **Payment Completed** — payment done, appointment scheduled
4. **Consultation Scheduled** — appointment in scheduled/rescheduled
5. **Consultation Held** — appointment marked as attended
6. **Case In Progress** — status is in_progress + has attended consultation
7. **Completion Requested** — status is pending_completion
8. **Case Completed** — status is completed or closed

---

## 10. APPOINTMENT STATUS MACHINE

```
┌─────────┐     ┌──────────────────┐     ┌───────────┐     ┌──────────┐
│ PENDING │ ──→ │ AWAITING_PAYMENT │ ──→ │ SCHEDULED │ ──→ │ ATTENDED │
└─────────┘     └──────────────────┘     └───────────┘     └──────────┘
 (client         (lawyer accepts)         (client pays)     (marked as held
  requests)                                                  by either party)
     │                                         │
     ↓                                         ↓
 ┌──────────┐                           ┌─────────────┐
 │ REJECTED │                           │ RESCHEDULED │
 └──────────┘                           └─────────────┘
 (lawyer declines)                      (time changed)
     
 ┌───────────┐
 │ CANCELLED │ (can happen from pending or awaiting_payment — NOT from scheduled/paid)
 └───────────┘
```

DB trigger `044` enforces valid transitions. DB trigger `047` requires at least one `attended` appointment before case can move to `pending_completion`.

---

## 11. SECURITY MEASURES

### Authentication & Authorization
- Supabase Auth with email/password
- Middleware-level route protection
- Layout-level role verification (client/lawyer/admin)
- RLS on all database tables
- Service role key for admin operations and DB triggers

### AI Security (Document Analysis)
- **Pre-LLM Security Scanner** (`lib/document-analysis-security.ts`):
  - 30+ regex patterns across 8 categories
  - Detects: instruction overrides, prompt extraction, role play attacks, config extraction, fake urgency, result manipulation, code injection, prompt stuffing
  - High-severity detections inject extra guardrails into the LLM prompt
- **Text Sanitization**: Control characters stripped before LLM processing
- **Server-side Enum Normalization**: Risk level, urgency, seriousness values normalized after LLM response
- **Non-legal Document Rejection**: LLM instructed to reject non-legal documents (licenses, recipes, etc.)

### Chatbot Security
- Rate limiting: 25 requests/minute/user
- Pakistani law guardrails: refuses Indian law, refuses non-legal topics
- Tool call fallback: if tool execution fails, retries without tools
- API key validation at startup

### Payment Security
- Stripe webhook signature verification
- Server-side payment validation
- No client-side amount manipulation possible

---

## 12. KEY LIBRARY FILES

| File | Purpose |
|---|---|
| `lib/supabase/client.ts` | Browser-side Supabase client (uses anon key) |
| `lib/supabase/server.ts` | Server-side Supabase client (uses cookies for auth) |
| `lib/supabase/middleware.ts` | Route protection middleware |
| `lib/analysis/run-document-analysis.ts` | Core AI analysis logic (Groq prompt, parsing, normalization) |
| `lib/document-analysis-security.ts` | Pre-LLM prompt injection scanner |
| `lib/ai/tools.ts` | Chatbot tool definitions (7 tools) |
| `lib/ai/lawyer-matching.ts` | Matches lawyers to case based on analysis summary |
| `lib/chatBotData.ts` | Chatbot system prompt |
| `lib/case-lifecycle-stages.ts` | Derives 8-stage progress stepper from real data |
| `lib/case-timeline.ts` | Timeline event types, labels, and insertion helper |
| `lib/notifications.ts` | Notification creation helper |
| `lib/rate-limit.ts` | Simple in-memory rate limiter |
| `lib/chat-routes.ts` | Normalizes navigation paths based on user role |
| `lib/chat-case-context.ts` | Extracts case ID from URL path for chat context |
| `lib/lawyer-search.ts` | Searches verified lawyers from Supabase |
| `lib/lawyer-rating.ts` | Rating display formatting utilities |
| `lib/recompute-lawyer-stats.ts` | Client-side fallback for rating recomputation |
| `lib/appointment-display.ts` | Human-readable appointment status labels |
| `lib/appointments-status.ts` | Appointment status helpers (billable check, labels) |
| `lib/specializations.ts` | List of lawyer specialization categories |
| `lib/case-disputes.ts` | Dispute query helper (currently disabled) |
| `lib/case-drafts.ts` | Case draft management |
| `lib/auth-store.ts` | Zustand auth state store |

---

## 13. COMPONENT ORGANIZATION

```
components/
├── admin/           → AdminHeader
├── ai/              → JudgeSimulationView
├── cases/           → CaseProgressStepper, CaseActivityFeed, DisputeModal (disabled)
├── chatbot/         → Chat (main chatbot widget)
├── client/          → Sidebar, Header, ReviewModal, PendingCaseReviewDialog
├── documents/       → UploadZone, AnalysisResultsView
├── landing/         → Landing page sections (Hero, Features, HowItWorks, etc.)
├── lawyer/          → Sidebar, DashboardHeader, LawyerCard, ActiveCases
├── notifications/   → NotificationBell, MessageBadge
├── ui/              → Shadcn components (Button, Card, Dialog, Select, Tabs, Badge, etc.)
└── progress-bar.tsx → Page transition progress indicator
```

---

## 14. FEATURES CURRENTLY DISABLED

| Feature | Status | Reason |
|---|---|---|
| **Dispute Module** | Commented out everywhere | Was causing admin-side crashes; simplified flow to just Confirm/Decline |
| **AI Recommendations Card** | Hidden from client dashboard | Page at `/client/ai-recommendations` still accessible directly |
| **Cron Job (Process Analysis Jobs)** | Endpoint exists | Vercel free tier limits cron scheduling |

---

## 15. WHAT MAKES THIS PROJECT VIVA-DEFENSIBLE

1. **AI Integration** — Not just a wrapper; uses structured prompting, pre-LLM security scanning, server-side normalization, and multi-tool chatbot
2. **Full Case Lifecycle** — From document upload → analysis → lawyer matching → booking → payment → consultation → completion → review, all managed within the platform
3. **Pakistani Law Focus** — Guardrails ensure the AI stays within Pakistani legal context
4. **Judicial Perspective Simulator** — Positioned as "stress testing" (not outcome prediction), which is ethically sound
5. **Real-time Features** — Dashboard, cases, messages, and appointments all update via Supabase Realtime
6. **Payment Integration** — Full Stripe flow with webhooks, not mock payments
7. **Multi-role Architecture** — Client, Lawyer, Admin with proper route protection and RLS
8. **Security Layers** — Prompt injection defense, rate limiting, RLS, middleware auth, webhook signature verification
9. **Database Triggers** — Business logic enforced at the DB level (rating recomputation, appointment validation, case completion guards)
