---
name: WiseCase Cases Management Implementation
overview: Complete the Cases Management module (Module 7) by implementing full Supabase integration for client and lawyer case dashboards, replacing dummy data with real database queries, and adding case detail views with status tracking, notes, and document management.
todos:
  - id: client-cases-page
    content: Replace dummy data in app/client/cases/page.tsx with Supabase query, add real-time subscriptions, and implement case status badges
    status: completed
  - id: lawyer-cases-page
    content: Create app/lawyer/cases/page.tsx with Supabase integration, status filters, and case management actions
    status: completed
  - id: update-active-cases
    content: Update components/lawyer/active-cases.tsx to fetch real data from Supabase instead of dummy data
    status: completed
  - id: lawyer-sidebar-cases
    content: Add Cases navigation item to components/lawyer/sidebar.tsx linking to /lawyer/cases
    status: completed
  - id: client-case-detail
    content: Create app/client/cases/[id]/page.tsx with case info, appointments, messages link, and documents section
    status: completed
    dependencies:
      - client-cases-page
  - id: lawyer-case-detail
    content: Create app/lawyer/cases/[id]/page.tsx with case info, status management, appointments, and documents
    status: completed
    dependencies:
      - lawyer-cases-page
  - id: case-status-management
    content: Implement case status update functionality with notifications and real-time updates
    status: completed
    dependencies:
      - lawyer-case-detail
  - id: case-activity-timeline
    content: Add activity timeline to case detail pages showing status changes, appointments, and document uploads
    status: completed
    dependencies:
      - client-case-detail
      - lawyer-case-detail
---

# WiseCase Project Analysis & Implementation Plan

## Current Project Status Analysis

### Database Schema Status: ✅ COMPLETE

All 20 migration scripts executed successfully:

- Core tables: profiles, lawyer_profiles, cases, appointments, messages, reviews, payments, documents, document_analysis, certifications, notifications
- RLS policies: All tables have proper row-level security
- Triggers: Auto-create profile (010) and lawyer_profile (014)
- Storage: Avatars bucket configured (018)
- Notifications: Full system ready (019, 020)

### Implementation Status vs PROJECT_PLAN.md

#### ✅ Fully Implemented (Matches Documentation)

1. **Authentication System** - Complete
2. **User Profiles** - Complete with avatar uploads
3. **Lawyer Discovery** - Live with real Supabase data
4. **Appointment Booking** - Request-based flow working, cases auto-created on booking
5. **Real-time Messaging** - Complete with case-based conversations
6. **Notification Center** - Complete with real-time subscriptions

#### ⚠️ Partially Implemented (Needs Work)

**Module 7: Cases Management**

- `/client/cases` page exists but uses **hardcoded dummy data** (lines 13-41 in `app/client/cases/page.tsx`)
- `/lawyer/cases` page **does not exist** (only `ActiveCases` widget on dashboard with dummy data)
- Case detail views missing
- Case status management UI missing
- Case notes/timeline missing
- Case document attachments UI missing

**Key Finding**: Cases ARE being created in the database when appointments are booked (see `components/lawyer/book-appointment-modal.tsx:249-263`), but the UI doesn't display them from Supabase.

### Critical Gaps Identified

1. **Client Cases Page** (`app/client/cases/page.tsx`)

- Currently shows 3 hardcoded cases
- Needs Supabase query: `SELECT * FROM cases WHERE client_id = auth.uid()`
- Needs real-time subscriptions for updates
- Needs navigation to case detail pages

2. **Lawyer Cases Page** (Missing)

- Need to create `app/lawyer/cases/page.tsx`
- Query: `SELECT * FROM cases WHERE lawyer_id = auth.uid()`
- Replace dummy `ActiveCases` widget with real data
- Add to lawyer sidebar navigation

3. **Case Detail Pages** (Missing)

- Need `app/client/cases/[id]/page.tsx`
- Need `app/lawyer/cases/[id]/page.tsx`
- Display: case info, status, appointments, messages, documents, timeline

4. **Case Status Management**

- Update case status (open → in_progress → completed → closed)
- Add case notes/timeline entries
- Real-time updates

5. **Case Documents Integration**

- Link existing documents table to case detail views
- Upload/download functionality

## Implementation Plan

### Phase 1: Client Cases Dashboard (Priority: HIGH)

**File**: `app/client/cases/page.tsx`

1. Replace dummy data with Supabase query

- Fetch cases where `client_id = current_user.id`
- Join with `profiles` to get lawyer info
- Join with `appointments` to show next appointment
- Join with `payments` to show payment status
- Order by `updated_at DESC`

2. Add real-time subscription

- Subscribe to `cases` table changes for current user
- Auto-refresh on case updates

3. Add case status badges

- Map DB statuses: `open`, `in_progress`, `completed`, `closed`
- Color-coded badges matching existing design system

4. Add action buttons

- "View Details" → navigate to `/client/cases/[id]`
- "Message" → navigate to `/client/messages?case=[id]`
- "Review" (only for completed cases) → navigate to review flow

### Phase 2: Lawyer Cases Management (Priority: HIGH)

**File**: `app/lawyer/cases/page.tsx` (NEW)

1. Create new page structure

- Similar layout to `app/lawyer/appointments/page.tsx`
- Use `LawyerDashboardHeader` and `LawyerSidebar` components

2. Fetch cases from Supabase

- Query: `SELECT * FROM cases WHERE lawyer_id = auth.uid()`
- Join with `profiles` for client info
- Join with `appointments` for upcoming meetings
- Filter by status (tabs: All, Open, In Progress, Completed, Closed)

3. Add case management actions

- Update case status dropdown
- View case details
- Navigate to messages
- View documents

4. Update lawyer sidebar

- Add "Cases" navigation item in `components/lawyer/sidebar.tsx`
- Link to `/lawyer/cases`

5. Replace `ActiveCases` widget

- Update `components/lawyer/active-cases.tsx` to fetch real data
- Show actual cases from database
- Add "View all" link to `/lawyer/cases`

### Phase 3: Case Detail Pages (Priority: HIGH)

**Files**:

- `app/client/cases/[id]/page.tsx` (NEW)
- `app/lawyer/cases/[id]/page.tsx` (NEW)

1. Case information section

- Title, description, case_type, status
- Client/lawyer info with avatar
- Created/updated dates
- Budget/hourly_rate info

2. Status management

- Status dropdown (client can view, lawyer can update)
- Status change notifications
- Status history/timeline

3. Related appointments

- List all appointments for this case
- Show scheduled, completed, cancelled
- Link to appointment details

4. Messages integration

- Show recent messages or link to messages page
- Quick message composer

5. Documents section

- List documents from `documents` table where `case_id = [id]`
- Upload new documents (if time permits)
- Document status indicators

6. Activity timeline

- Case created
- Status changes
- Appointments scheduled/completed
- Documents uploaded
- Messages sent (optional)

### Phase 4: Enhancements (Priority: MEDIUM)

1. Case notes system

- Add `case_notes` table or use existing structure
- Allow lawyers to add private notes
- Display in case detail view

2. Case search and filters

- Search by title, case_type
- Filter by status, date range
- Sort options

3. Case statistics

- Total cases, active cases, completed cases
- Average case duration
- Revenue per case (for lawyers)

## Technical Implementation Details

### Database Queries Pattern

Follow existing patterns from `app/lawyer/appointments/page.tsx`:

- Use `createClient()` from `@/lib/supabase/client`
- Get session with `supabase.auth.getSession()`
- Use `.select()` with joins for related data
- Handle errors with toast notifications
- Add loading states

### Real-time Subscriptions

Follow pattern from `components/lawyer/client-requests.tsx`:

- Create channel: `supabase.channel('cases-updates-${userId}')`
- Subscribe to `postgres_changes` on `cases` table
- Filter by `client_id` or `lawyer_id`
- Refresh data on changes

### Status Management

- Use existing status values: `'open'`, `'in_progress'`, `'completed'`, `'closed'`
- Create notification on status change using `lib/notifications.ts`
- Update `updated_at` timestamp

### UI Components to Reuse

- `Card`, `Badge`, `Button` from `@/components/ui`
- Status badges pattern from `app/lawyer/appointments/page.tsx`
- Loading states from existing pages
- Error handling with `useToast`

## Files to Create/Modify

### New Files

1. `app/lawyer/cases/page.tsx` - Lawyer cases management page
2. `app/client/cases/[id]/page.tsx` - Client case detail page
3. `app/lawyer/cases/[id]/page.tsx` - Lawyer case detail page

### Files to Modify

1. `app/client/cases/page.tsx` - Replace dummy data with Supabase
2. `components/lawyer/active-cases.tsx` - Fetch real data
3. `components/lawyer/sidebar.tsx` - Add Cases navigation

### Optional Enhancements

- `lib/cases.ts` - Helper functions for case operations
- Case status change notifications
- Case activity log component

## Success Criteria

1. ✅ Client can view all their cases from database
2. ✅ Lawyer can view all their cases from database
3. ✅ Both can view case details with full information
4. ✅ Case status can be updated (lawyer)
5. ✅ Real-time updates when cases change
6. ✅ Navigation flows work (cases → details → messages)
7. ✅ UI matches existing design system
8. ✅ RLS policies enforced correctly

## Estimated Time

- Phase 1 (Client Cases): 4-6 hours
- Phase 2 (Lawyer Cases): 4-6 hours
- Phase 3 (Case Details): 6-8 hours
- Phase 4 (Enhancements): 4-6 hours
**Total: 18-26 hours (2-3 days)**