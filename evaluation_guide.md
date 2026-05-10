# WiseCase - Evaluation Guide
**Core Explanation & System Architecture**

---

## 🚀 1. Project Overview (The "Elevator Pitch")
**WiseCase** is an intelligent legal services platform connecting clients with lawyers. Unlike traditional simplified directories, WiseCase handles the entire lifecycle of legal assistance:
- **Discovery**: Finding the right lawyer via smart filters.
- **Booking**: Real-time appointment scheduling with double-booking protection.
- **Management**: Full case lifecycle tracking (Open -> In Progress -> Closed).
- **Communication**: Real-time secure messaging.
- **Financials**: Integrated Stripe payments.

---

## 🛠️ 2. Technical Stack (What we used)
*   **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS.
*   **Backend**: Supabase (PostgreSQL), Supabase Auth, Edge Functions.
*   **Real-time**: Supabase Realtime (Websockets for chat & notifications).
*   **Payments**: Stripe API (Checkout + Webhooks).
*   **UI Components**: Shadcn/UI (Radix Primitives).

---

## 🏗️ 3. Core Architecture
We use a **Serverless Architecture** relying heavily on Supabase's managed services.
*   **Auth**: Managed by Supabase GoTrue.
*   **Database**: PostgreSQL with Row Level Security (RLS) for data protection.
*   **API**: Next.js Server Actions & Route Handlers (`/app/api/...`).

---

## 📦 4. Key Modules Breakdown

### A. Authentication & Profiles
*   **Dual User Types**: Client vs. Lawyer.
*   **Implementation**: `profiles` table linked to `auth.users`.
*   **Automation**: Triggers automatically create profile rows upon sign-up.

### B. Smart Booking System
*   **Conflict Detection**: Before booking, we check `appointments` for overlapping time slots.
*   **Status Workflow**: `Pending` (Request) -> `Awaiting Payment` (Accepted) -> `Scheduled` (Paid).
*   **Data Integrity**: An Appointment cannot exist without a parent Case.

### C. Real-time Messaging
*   **Tech**: Supabase Realtime Channels.
*   **Security**: RLS policies ensure only case participants can read messages.
*   **UX**: Optimistic UI updates (message appears instantly before server confirms).

### D. Financial Integration
*   **Security**: We never store card details.
*   **Flow**: Payment Intents created server-side -> Stripe Hosted Checkout -> Webhook confirmation.

---

## 🔄 5. Data Flow Summary (For Q&A)

**Q: "How does a booking happen?"**
> "User selects a slot -> Frontend verifies availability -> Creates a 'Case' -> Creates a 'Pending Appointment' -> Notifies Lawyer. Once Lawyer accepts, status becomes 'Awaiting Payment' -> User pays -> Status becomes 'Scheduled'."

**Q: "how do you handle real-time updates?"**
> "We subscribe to PostgreSQL database changes via WebSockets. When a row is inserted into `messages` or `notifications`, the connected client receives a payload instantly without polling."

---

## 🔮 6. Future: Document Analysis (Planned)
*   **Goal**: AI-powered review of uploaded legal documents.
*   **Method**: Upload to Storage -> Trigger Edge Function -> OpenAI/LLM Analysis -> Save results to `document_analysis` table.
