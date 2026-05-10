# WiseCase Application Architecture Map

**Last Updated:** May 7, 2026  
**Application Type:** Next.js 14+ Legal Tech Platform (Client + Lawyer Marketplace)  
**Tech Stack:** TypeScript, React, Tailwind CSS, Supabase, Stripe, Groq AI, Tesseract OCR

---

## 📋 Table of Contents
1. [Project Structure Overview](#project-structure-overview)
2. [API Routes](#api-routes)
3. [Components by Feature](#components-by-feature)
4. [Custom Hooks](#custom-hooks)
5. [Utilities & Libraries](#utilities--libraries)
6. [Configuration Files](#configuration-files)
7. [Core Features Implementation](#core-features-implementation)
8. [Authentication & Authorization](#authentication--authorization)

---

## 🏗️ Project Structure Overview

```
WiseCase/
├── app/                          # Next.js app router
│   ├── api/                      # API routes
│   ├── auth/                     # Authentication pages
│   ├── client/                   # Client dashboard & features
│   ├── lawyer/                   # Lawyer dashboard & features
│   ├── admin/                    # Admin panel
│   ├── match/                    # Lawyer matching page
│   ├── privacy/                  # Legal pages
│   ├── register/                 # Registration
│   ├── terms/                    # Terms & conditions
│   ├── test-connection/          # Dev testing
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Home page
│   ├── globals.css               # Global styles
│   └── robots.ts, sitemap.ts     # SEO
├── components/                   # Reusable React components
│   ├── ui/                       # shadcn UI components
│   ├── auth/                     # Auth-related components
│   ├── cases/                    # Case management
│   ├── chat/                     # Chat messaging
│   ├── chatbot/                  # AI chatbot
│   ├── documents/                # Document handling
│   ├── payments/                 # Payment flows
│   ├── notifications/            # Notification UI
│   ├── lawyer/                   # Lawyer-specific UI
│   ├── client/                   # Client-specific UI
│   ├── admin/                    # Admin UI
│   ├── sections/                 # Landing page sections
│   ├── site-header.tsx
│   ├── site-footer.tsx
│   ├── theme-provider.tsx
│   └── progress-bar.tsx
├── lib/                          # Utility functions & services
│   ├── supabase/                 # Supabase client & server setup
│   ├── stripe/                   # Stripe configuration
│   ├── ai/                       # AI utilities (matching, tools)
│   ├── auth-store.ts             # Zustand auth store
│   ├── chat-routes.ts            # Chat navigation logic
│   ├── notifications.ts          # Notification creation
│   ├── specializations.ts        # Law specializations constants
│   ├── chatBotData.ts            # Chatbot system prompts
│   ├── chat-routes.ts            # Navigation routing
│   ├── recompute-lawyer-stats.ts # Stats recalculation
│   ├── utils.ts                  # Tailwind utilities
│   └── validate-env.ts           # Environment validation
├── hooks/                        # Custom React hooks
│   ├── use-toast.ts              # Toast notifications
│   └── use-unread-messages.ts    # Message badge state
├── data/                         # Static data
│   └── cities-pk.ts              # Pakistan cities list
├── public/                       # Static assets
├── scripts/                      # Database migrations
├── middleware.ts                 # Next.js middleware
├── next.config.mjs               # Next.js config
├── tsconfig.json                 # TypeScript config
├── components.json               # shadcn config
└── package.json                  # Dependencies

```

---

## 🌐 API Routes

### **Analyze Document** (`/api/analyze-document`)
- **Route:** `POST /api/analyze-document`
- **Purpose:** AI-powered legal document analysis
- **Features:**
  - PDF parsing and OCR (Tesseract)
  - Document categorization (10 law specializations)
  - Groq AI processing
  - Lawyer matching based on document category
  - Stores analysis results in `document_analysis` table
- **File:** [app/api/analyze-document/route.ts](app/api/analyze-document/route.ts)

### **Chat & AI** (`/api/chat`)
- **Route:** `POST /api/chat`
- **Purpose:** Real-time AI chat with context awareness
- **Features:**
  - Groq AI integration (language model)
  - Message history retrieval
  - Page context awareness
  - AI tools integration (navigation, profile checks)
  - Role-based responses (guest, client, lawyer)
  - Dynamic authentication context
- **Subroutes:**
  - `GET /api/chat/history` - Retrieve chat message history
- **Files:**
  - [app/api/chat/route.ts](app/api/chat/route.ts)
  - [app/api/chat/history/route.ts](app/api/chat/history/route.ts)

### **Stripe Payment Processing** (`/api/stripe/*`)
- **Purpose:** Payment and subscription management
- **Subroutes:**
  1. **Create Checkout Session** - `POST /api/stripe/create-checkout-session`
     - Creates Stripe checkout for appointments
     - Validates appointment status (`awaiting_payment`)
     - Generates secure payment sessions
     - File: [app/api/stripe/create-checkout-session/route.ts](app/api/stripe/create-checkout-session/route.ts)

  2. **Create Payment Intent** - `POST /api/stripe/create-payment-intent`
     - Direct payment intent creation
     - Alternative to checkout sessions

  3. **Verify Payment** - `POST /api/stripe/verify-payment`
     - Verifies payment status
     - Updates appointment status
     - Triggers notifications

  4. **Webhook** - `POST /api/stripe/webhook`
     - Stripe webhook handler
     - Payment success/failure events
     - Subscription management

---

## 🎨 Components by Feature

### **Authentication Components** (`/components/auth`)
| Component | Purpose |
|-----------|---------|
| `auth-alert.tsx` | Auth status alerts & messages |
| `auth-form-field.tsx` | Reusable form field with validation |
| `file-upload.tsx` | File upload for registrations/profiles |

### **Case Management** (`/components/cases`)
| Component | Purpose |
|-----------|---------|
| `dispute-modal.tsx` | Modal for initiating case disputes |

### **Chat & Messaging** (`/components/chat`)
| Component | Purpose |
|-----------|---------|
| `messages-shell.tsx` | Chat message container & UI |

### **AI Chatbot** (`/components/chatbot`)
| Component | Purpose |
|-----------|---------|
| `Chat.tsx` | Main chat interface |
| `chatbot.tsx` | Chatbot logic & state management |

### **Document Analysis** (`/components/documents`)
| Component | Purpose |
|-----------|---------|
| `upload-zone.tsx` | Document drag-drop upload zone |
| `analysis-results-view.tsx` | Display analyzed document results |

### **Payment Processing** (`/components/payments`)
| Component | Purpose |
|-----------|---------|
| `payment-button.tsx` | Trigger payment flow |
| `stripe-checkout.tsx` | Stripe checkout form |

### **Lawyer Features** (`/components/lawyer`) - 18 Components
| Component | Purpose |
|-----------|---------|
| `dashboard-header.tsx` | Lawyer dashboard header |
| `sidebar.tsx` | Lawyer navigation sidebar |
| `active-cases.tsx` | Display active cases |
| `upcoming-appointments.tsx` | Schedule view |
| `availability-calendar.tsx` | Calendar for availability management |
| `client-requests.tsx` | Incoming client appointment requests |
| `management-hub.tsx` | Cases & appointments management hub |
| `lawyer-card.tsx` | Lawyer profile card (search results) |
| `lawyer-profile-header.tsx` | Profile header with info |
| `lawyer-certifications.tsx` | Certifications display |
| `lawyer-filters.tsx` | Filter lawyers by specialization, rating |
| `book-appointment-modal.tsx` | Modal to book appointments |
| `case-studies.tsx` | Case success stories showcase |
| `certificates.tsx` | Certificate management |
| `profile-completion-card.tsx` | Profile setup progress |
| `reviews.tsx` | Client reviews & ratings |
| `testimonials.tsx` | Testimonials section |
| `verification-notice.tsx` | Verification status indicator |

### **Client Features** (`/components/client`) - 4 Components
| Component | Purpose |
|-----------|---------|
| `header.tsx` | Client dashboard header |
| `sidebar.tsx` | Client navigation sidebar |
| `pending-case-review-dialog.tsx` | Modal for case reviews |
| `review-modal.tsx` | Modal for writing reviews |

### **Notifications** (`/components/notifications`)
| Component | Purpose |
|-----------|---------|
| `notification-bell.tsx` | Bell icon with notification badge |
| `message-badge.tsx` | Unread message count badge |
| `notification-toast-listener.tsx` | Real-time toast notification listener |

### **Admin Panel** (`/components/admin`)
| Component | Purpose |
|-----------|---------|
| `admin-header.tsx` | Admin dashboard header |

### **Landing Page Sections** (`/components/sections`)
| Component | Purpose |
|-----------|---------|
| `hero.tsx` | Hero/banner section |
| `features.tsx` | Features showcase |
| `carousel.tsx` | Image carousel |
| `city-online-select.tsx` | City selection with online status |

### **UI Components** (`/components/ui`) - shadcn/ui Library
Standard shadcn components for consistent design:
- `alert.tsx`, `avatar.tsx`, `badge.tsx`, `button.tsx`, `card.tsx`
- `dialog.tsx`, `dropdown-menu.tsx`, `input.tsx`, `label.tsx`, `progress.tsx`
- `select.tsx`, `tabs.tsx`, `textarea.tsx`, `toast.tsx`, `toaster.tsx`

### **Layout Components**
| Component | Purpose |
|-----------|---------|
| `site-header.tsx` | Global header/navigation |
| `site-footer.tsx` | Global footer |
| `theme-provider.tsx` | Theme context provider |
| `progress-bar.tsx` | Route progress indicator |

---

## 🪝 Custom Hooks

### **Authentication & Toast**
| Hook | File | Purpose |
|------|------|---------|
| `useAuthStore()` | `lib/auth-store.ts` | Zustand store for user authentication state, profile data, loading & errors |
| `useToast()` | `hooks/use-toast.ts` | Toast notification trigger |

### **Real-Time Updates**
| Hook | File | Purpose |
|------|------|---------|
| `useUnreadMessages()` | `hooks/use-unread-messages.ts` | Track unread message count for notification badge |

---

## 🛠️ Utilities & Libraries

### **Authentication & Store** (`lib/auth-store.ts`)
```typescript
useAuthStore()          // Main auth state management
  ├── user             // Current logged-in user
  ├── isLoading        // Loading state
  ├── error            // Error messages
  ├── initializeAuth() // Initialize from session
  ├── setUser()        // Update user
  └── logout()         // Sign out
```

### **Notification System** (`lib/notifications.ts`)
```typescript
createNotification()       // Generic notification creation
notifyAppointmentRequest() // Appointment request notifications
notifyAppointmentUpdate()  // Appointment status updates
notifyMessage()            // New message alerts
notifySystemEvent()        // System events
notifyAnalysisComplete()   // Document analysis completion

// Notification Types:
- "system"              // System announcements
- "message"             // Chat messages
- "appointment_request" // Appointment requests
- "appointment_update"  // Appointment status changes
- "case_update"         // Case status updates
- "payment_update"      // Payment status updates
```

### **AI & Lawyer Matching** (`lib/ai/`)
| Module | Purpose |
|--------|---------|
| `lawyer-matching.ts` | AI-powered lawyer matching algorithm, keyword scoring, specialization matching |
| `tools.ts` | AI tools for chat (navigation, profile checks, form fields) |

**Lawyer Matching Features:**
- Specialization keyword matching
- Rating & success rate scoring
- Availability consideration
- Verification status checking

### **Chat & Navigation** (`lib/chat-routes.ts`)
```typescript
normalizeChatNavigationPath()  // Convert paths based on user role
// Routes are role-aware:
// - Guests: /auth routes
// - Clients: /client/* routes
// - Lawyers: /lawyer/* routes
```

### **Supabase Integration** (`lib/supabase/`)
| Module | Purpose |
|--------|---------|
| `client.ts` | Browser-side Supabase client with validation |
| `server.ts` | Server-side Supabase client |
| `middleware.ts` | Auth session update middleware |
| `validate-env.ts` | Environment variable validation |

### **Stripe Configuration** (`lib/stripe/config.ts`)
```typescript
stripe  // Stripe API client (server-side)
```

### **Constants & Data** 
| Module | Purpose |
|--------|---------|
| `specializations.ts` | LAW_SPECIALIZATIONS array (10 practice areas) |
| `chatBotData.ts` | System prompts & initial messages for AI chatbot |

### **Utilities**
| Function | File | Purpose |
|----------|------|---------|
| `cn()` | `utils.ts` | Tailwind CSS class merger (clsx + twMerge) |
| `recomputeLawyerRatingStats()` | `recompute-lawyer-stats.ts` | Recalculate lawyer ratings from reviews |

---

## ⚙️ Configuration Files

### **next.config.mjs**
- ESLint/TypeScript error ignoring (for faster builds)
- Image optimization disabled
- Webpack config for process fallback (browser compatibility)

### **tsconfig.json**
- TypeScript strict mode enabled
- ES6 target
- Path alias: `@/*` → `./` (root)
- Incremental builds for faster dev

### **components.json** (shadcn Config)
- Style: `new-york`
- UI Library: Radix UI + Tailwind CSS
- Icons: Lucide
- CSS Variables: Enabled
- Path aliases configured for components, utils, hooks, lib

### **middleware.ts**
- Runtime: Node.js
- Calls Supabase middleware for auth session updates
- Matcher pattern ignores static assets & Next.js internals

---

## 🔐 Authentication & Authorization

### **Flow: Middleware → Supabase → Pages**

1. **Middleware** (`middleware.ts`)
   - Runs on every request
   - Updates Supabase session cookies
   - Ensures auth state consistency

2. **Auth Pages** (`app/auth/`)
   - `/auth/client/sign-in` - Client login
   - `/auth/lawyer/sign-in` - Lawyer login
   - `/auth/admin/sign-in` - Admin login
   - `/auth/callback` - OAuth callback
   - `/auth/forgot-password` - Password recovery
   - `/auth/reset-password` - Password reset

3. **Client-Side Auth** (`lib/auth-store.ts`)
   - Zustand store manages user state
   - `initializeAuth()` runs on app load
   - Persists session across page reloads

4. **Protected Routes**
   - `/client/*` - Requires client role
   - `/lawyer/*` - Requires lawyer role
   - `/admin/*` - Requires admin role

---

## 📱 Core Features Implementation

### **1. Document Analysis Pipeline**
**Location:** `/client/analysis` → `POST /api/analyze-document`

```
Upload Document → PDF Parsing → OCR (Tesseract) → Groq AI Processing 
→ Category Detection → Lawyer Matching → Store Results → Display Analysis
```

**Components Involved:**
- `documents/upload-zone.tsx` - UI upload
- `documents/analysis-results-view.tsx` - Results display
- `api/analyze-document/route.ts` - Processing
- Database: `documents`, `document_analysis` tables

---

### **2. AI Chat System**
**Location:** `/chat` → `POST /api/chat`

```
User Message → Groq AI Processing → Role-Based Context → AI Tools Execution 
→ Response Generation → History Storage → Real-Time Display
```

**Components Involved:**
- `chatbot/Chat.tsx` - Chat UI
- `chatbot/chatbot.tsx` - Chat logic
- `api/chat/route.ts` - Groq integration
- `api/chat/history/route.ts` - History retrieval
- AI Tools: Navigation, Profile checks, Form field suggestions
- Database: `ai_chat_messages` table

---

### **3. Lawyer Matching System**
**Location:** Document analysis → Lawyer search

```
Document Category → Specialization Keywords → Lawyer Database Query
→ Scoring Algorithm → Rating & Success Filter → Sorted Results
```

**Implementation:**
- `lib/ai/lawyer-matching.ts` - Matching algorithm
- Specializations: Corporate, Family, Criminal, Real Estate, Immigration, Tax, Labor, IP, Bankruptcy, Civil
- Scoring factors: Keyword overlap, rating, success rate, availability
- Database: `profiles`, `lawyer_profiles` tables

---

### **4. Payment & Appointment System**
**Location:** `/client/appointments` / `/lawyer/appointments`

```
Client Request → Create Appointment (awaiting_payment) 
→ Stripe Checkout → Payment Processing → Notification → Status Update
```

**API Endpoints:**
- `POST /api/stripe/create-checkout-session` - Start payment
- `POST /api/stripe/verify-payment` - Verify & update
- `POST /api/stripe/webhook` - Async updates

**Database Tables:** `appointments`, `payments`

---

### **5. Real-Time Notifications**
**Location:** Multiple features

```
Event Trigger → Notification Creation → Badge Update → Toast Display
```

**Types:**
- Appointment requests
- Appointment updates (confirmed, rescheduled, cancelled)
- New messages
- Case status updates
- Payment confirmations
- Document analysis completion

**Components:** `notifications/notification-bell.tsx`, `notification-toast-listener.tsx`

---

### **6. Client Dashboard**
**Location:** `/client/dashboard`

```
User Profile → Active Cases → Appointments → Messages → Payments Status
```

**Sub-routes:**
- `/client/cases` - Case management
- `/client/appointments` - Schedule management
- `/client/messages` - Chat with lawyers
- `/client/documents` - Uploaded documents
- `/client/analysis` - Document analysis
- `/client/ai-recommendations` - AI suggested lawyers
- `/client/payments` - Payment history
- `/client/reviews` - Reviews given
- `/client/profile` - Profile settings
- `/client/settings` - Account settings

---

### **7. Lawyer Dashboard**
**Location:** `/lawyer/dashboard`

```
Profile Management → Cases → Appointments → Client Requests → Messages → Reviews
```

**Sub-routes:**
- `/lawyer/profile` - Profile & specializations
- `/lawyer/cases` - Active cases
- `/lawyer/appointments` - Schedule
- `/lawyer/messages` - Client messages
- `/lawyer/profiles` - Public profile view

---

### **8. Admin Panel**
**Location:** `/admin/dashboard`

**Sub-routes:**
- `/admin/dashboard` - Overview
- `/admin/disputes` - Case disputes
- `/admin/lawyers` - Lawyer management
- `/admin/users` - User management

---

### **9. Lawyer Discovery & Matching**
**Location:** `/match`

```
Search/Filter Lawyers → View Profiles → Read Reviews → Book Appointment
```

**Features:**
- Filter by specialization
- Filter by rating
- View certificates
- Read testimonials
- View case studies
- Book appointment modal

---

## 📊 Database Schema (Supabase)

**Key Tables:**
- `profiles` - User authentication & basic info
- `lawyer_profiles` - Lawyer-specific details (specializations, rates, stats)
- `appointments` - Appointment records
- `cases` - Legal cases
- `documents` - Uploaded documents
- `document_analysis` - AI analysis results
- `messages` - Chat messages
- `ai_chat_messages` - Chatbot history
- `notifications` - User notifications
- `payments` - Payment records
- `reviews` - Lawyer reviews & ratings

---

## 🔄 Data Flow Diagram

```
┌─────────────────┐
│   Client/User   │
└────────┬────────┘
         │
    ┌────▼────────────────┐
    │  Next.js Frontend    │
    │  (React Components)  │
    └────┬────────────────┘
         │
    ┌────▼────────────────────────────────┐
    │   API Routes (/api/*)                │
    │  - Chat (Groq AI)                    │
    │  - Document Analysis                 │
    │  - Stripe Payment                    │
    └────┬────────────────────────────────┘
         │
    ┌────▼──────────────────┐
    │   External Services   │
    │  - Groq AI (LLM)      │
    │  - Stripe (Payments)  │
    │  - Tesseract (OCR)    │
    └────┬──────────────────┘
         │
    ┌────▼──────────────────┐
    │   Supabase Backend     │
    │  - PostgreSQL DB       │
    │  - Auth               │
    │  - Real-time (websub) │
    │  - Storage            │
    └───────────────────────┘
```

---

## 🚀 Key Technologies & Integrations

| Technology | Purpose | Version |
|-----------|---------|---------|
| **Next.js** | React framework & API routes | 14+ |
| **React** | UI library | 18+ |
| **TypeScript** | Type safety | Latest |
| **Tailwind CSS** | Styling | Latest |
| **shadcn/ui** | UI components (Radix) | Latest |
| **Supabase** | Backend DB & Auth | Latest |
| **Stripe** | Payment processing | Latest |
| **Groq AI** | LLM chat API | 3.0+ |
| **Tesseract.js** | OCR for PDFs | Latest |
| **Zustand** | State management | Latest |
| **React Hook Form** | Form validation | 3.10+ |
| **pdf-parse-fork** | PDF parsing | Latest |
| **Vercel Analytics** | Analytics | Latest |

---

## 📝 Notes & Best Practices

1. **Role-Based Access:** Always check `user_type` (client/lawyer/admin)
2. **API Authentication:** Server-side client for sensitive operations
3. **AI Tools:** Available in chat for navigation & profile checks
4. **Real-Time:** Supabase realtime for notifications & messages
5. **File Uploads:** Stored in Supabase Storage buckets
6. **Payment Status:** Tracks in `appointments.status` (awaiting_payment, completed, etc.)
7. **Chat Context:** Page context included for contextual AI responses
8. **Environment Validation:** All env vars validated on startup

---

**End of Architecture Map** | Generated for WiseCase Legal Tech Platform
