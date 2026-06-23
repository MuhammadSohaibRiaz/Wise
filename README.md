# Smart Lawyer Booking System (WiseCase)

A full-stack legal technology platform built for Pakistan, connecting clients with verified lawyers through AI-powered case analysis, secure document processing, appointment booking, and integrated payments.

---

## Features

### For Clients
- **AI Case Analysis** — Upload a legal document (PDF/image/DOCX); the system performs OCR, scans for injection attacks, runs a Groq LLM analysis, and returns risk level, urgency, seriousness score, legal citations, and next-step recommendations — all grounded in Pakistani law (PPC, CPC, CrPC)
- **Plain Language Explanation** — One-click "Explain Simply" rewrites any legal summary into plain everyday language using a secondary Groq call
- **Lawyer Matching** — AI matches the document's legal category against verified lawyer specializations to surface the best-fit lawyers
- **Appointment Booking** — Request, reschedule, or cancel consultations; real-time status updates via Supabase Realtime
- **Secure Payments** — Stripe-powered payment flow with PKR default currency; payment release tied to case completion
- **Case Management** — Track all active, completed, and cancelled cases; private notes, documents, and timeline events per case
- **Dispute Resolution** — Raise disputes on completed cases; admin mediates
- **Legal Chatbot** — RAG-based chatbot (Pinecone + Groq) for general legal Q&A

### For Lawyers
- **Verification Gate** — Lawyers must upload credentials; admin approves before access is granted
- **Case Dashboard** — View assigned cases, client documents, and appointment requests
- **Judge Simulation** — AI simulates courtroom proceedings for case preparation
- **Rating System** — Auto-recomputed average rating from verified client reviews after case completion

### For Admins
- **User & Lawyer Management** — Approve/reject lawyer verifications, manage all users
- **Dispute & Cancellation Queue** — Review and resolve disputes and cancellation requests
- **Security Logs** — Monitor AI injection attack attempts detected during document analysis
- **Real-time Dashboards** — Live feeds of appointments, payments, and case activity

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Next.js API Routes (Node.js runtime) |
| Database | Supabase (PostgreSQL) with Row-Level Security |
| Auth | Supabase Auth (email/password + email verification) |
| AI — Analysis | Groq API (`llama-3.3-70b-versatile` for text, `llama-4-scout-17b` for vision/OCR) |
| AI — RAG Chat | Pinecone vector store + Groq LLM |
| Payments | Stripe (checkout sessions, webhooks) |
| Email | Resend (verification emails, notifications) |
| Storage | Supabase Storage (documents, lawyer portfolio, profile images) |
| Realtime | Supabase Realtime (appointments, cases, notifications) |

---

## AI Document Analysis Pipeline

```
Upload (PDF / Image / DOCX, max 10 MB)
    │
    ▼
Extract text
  ├─ PDF     → pdf-parse-fork
  ├─ Image   → Groq Vision OCR (Llama-4-Scout)
  └─ DOCX    → partial (metadata only)
    │
    ▼
Injection Scan (34 regex patterns, 8 attack categories)
  → logged to ai_security_logs; high-severity adds a prompt warning block
    │
    ▼
Groq LLM Analysis (llama-3.3-70b, temp=0, JSON mode)
  → Deterministic rubric: risk_level / urgency / seriousness
  → Grounding check: amounts, names, PPC sections verified against source text
  → Auto-repair pass if grounding fails
    │
    ▼
Position Score (0–100)
  = 50 base
  + 10 grounding passed
  + 10 confidence ≥ 0.7
  + 10 evidence markers found
  − 5/10 for Medium/High risk
    │
    ▼
Lawyer Matching → specialization vector match
Results stored in document_analysis table
```

---

## Project Structure

```
app/
  (auth)/           Sign-in, register, callback pages per role
  admin/            Admin dashboard, user/lawyer/dispute management
  client/           Client dashboard, cases, analysis, appointments, chat
  lawyer/           Lawyer dashboard, cases, appointments, verification
  api/              All API routes (analyze-document, appointments, cases, payments, …)

components/
  client/           Client-specific UI (sidebar, header, lawyer cards)
  documents/        Upload zone, analysis results view, case strength meter
  lawyer/           Lawyer card, verification components
  ui/               shadcn/ui primitives

lib/
  analysis/         Groq analysis runner, grounding validation, position score
  auth/             Protected route rules, session helpers, redirect utilities
  supabase/         Browser, server, admin, and middleware clients
  ai/               Lawyer matching, capacity error handling

scripts/            All Supabase SQL migrations (001_*.sql → 063_*.sql)
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- A Supabase project
- Groq API key
- Stripe account (for payments)
- Resend account (for emails)
- Pinecone index (for RAG chatbot)

### Setup

```bash
git clone <repo-url>
cd wisecase
npm install
```

Copy the environment template and fill in your credentials:

```bash
cp .env.local.example .env.local
```

Required environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

GROQ_API_KEY=

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

RESEND_API_KEY=

PINECONE_API_KEY=
PINECONE_INDEX_NAME=
```

### Run migrations

Execute all SQL files in `/scripts/` in order (001 → 063) in the Supabase SQL editor.

### Start development server

```bash
npm run dev
```

---

## Security

- Row-Level Security (RLS) enforced on every Supabase table
- Server-side auth validation in Next.js middleware before any route renders
- Email verification required before first login
- Lawyer license verification required before platform access
- Pre-LLM injection scanner blocks prompt-hijacking attempts in uploaded documents
- Fact-grounding layer prevents AI hallucinations in analysis output
- Stripe webhook signature verification on all payment events

---

## User Roles

| Role | Access |
|------|--------|
| `client` | Case analysis, lawyer discovery, booking, payments, chat |
| `lawyer` | Case management, appointment handling, judge simulation |
| `admin` | Full platform oversight, lawyer verification, dispute resolution |

---

## Final Year Project — COMSATS LAHORE CAMPUS

Built as a Final Year Project demonstrating applied AI, full-stack web development, and legal-tech integration within the Pakistani legal ecosystem.
