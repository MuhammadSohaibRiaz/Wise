# WiseCase - Complete Data Flow Understanding

This document outlines exactly how data moves through the WiseCase application for every major module. It connects user actions on the frontend to the specific database operations and triggers that happen on the backend.

---

## 1. User Registration Flow
**Goal**: Create a new authenticated user (Client or Lawyer).

### The Flow
1.  **Frontend**: User submits the Sign-Up form at `/auth/signup`.
    *   **Data**: Email, Password, First Name, Last Name, User Type.
2.  **Auth API**: App calls `supabase.auth.signUp()`.
3.  **Supabase Internal**: Creates a record in the hidden `auth.users` table.
4.  **Database Trigger** (The Magic):
    *   **Script**: `scripts/010_create_triggers.sql` contains the `on_auth_user_created` trigger.
    *   **Action**: Automatically fires `handle_new_user()` function.
    *   **Result**: Implementation inserts a corresponding row into the public **`profiles`** table.
5.  **Lawyer Specific**:
    *   If `user_type = 'lawyer'`, another trigger (`scripts/014_auto_create_lawyer_profile.sql`) fires.
    *   **Result**: Automatically creates a row in the **`lawyer_profiles`** table linked to the main profile.

**Key Tables**: `auth.users`, `public.profiles`, `public.lawyer_profiles`

---

## 2. Appointment Booking Flow
**Goal**: A client books a slot with a lawyer.

### The Flow
1.  **Selection**: Client picks a date/time in `BookAppointmentModal`.
2.  **Step 1: Create Case Folder**:
    *   **Action**: `supabase.from('cases').insert(...)`
    *   **Status**: Starts as **`'open'`**.
    *   **Why**: Every interaction must live inside a "Case" container.
3.  **Step 2: Create Appointment**:
    *   **Action**: `supabase.from('appointments').insert(...)`
    *   **Data**: Links `case_id`, `client_id`, `lawyer_id`.
    *   **Status**: Sets to **`'pending'`** (Script `016`).
4.  **Step 3: Notification**:
    *   **Action**: Frontend calls `notifyAppointmentRequest`.
    *   **Result**: Row added to `notifications` table for the lawyer.
5.  **Step 4: Lawyer Review**:
    *   Lawyer clicks "Accept" in dashboard.
    *   **Update**: Appointment status -> **`'awaiting_payment'`**.
    *   **Note**: This status blocks the slot from being double-booked but marks it as tentative.

**Key Tables**: `cases`, `appointments`, `notifications`

---

## 3. Payment Flow
**Goal**: Client pays for the accepted appointment.

### The Flow
1.  **Initiation**: Client sees "Pay Now" button for `awaiting_payment` appointment.
2.  **Stripe Checkout**:
    *   App calls `/api/stripe/create-checkout-session`.
    *   Client is redirected to Stripe's secure page.
3.  **Payment Success**:
    *   Client completes payment.
    *   Stripe signals success via two channels: **Webhook** (backend) + **Redirect** (frontend).
4.  **Database Updates** (Handled by Webhook or Verification API):
    *   **Payments Table**: Insert/Update row with `status='completed'`.
    *   **Appointments Table**: Update status -> **`'scheduled'`**.
    *   **Cases Table**: Update status -> **`'in_progress'`**.
5.  **Notifications**:
    *   System inserts notifications for both Client ("Payment Successful") and Lawyer ("Payment Received").

**Key Tables**: `payments`, `appointments`, `cases`, `notifications`

---

## 4. Real-time Messaging Flow
**Goal**: Private chat between Client and Lawyer.

### The Flow
1.  **Sending**: User types message and hits Send.
    *   **Action**: `supabase.from('messages').insert(...)`
    *   **Constraint**: RLS policy `messages_insert_own` ensures user can only send as themselves.
2.  **Real-time Delivery**:
    *   **No API Call Needed for reading**: The recipient's browser is subscribed to `supabase.channel('messages')`.
    *   Supabase pushes the new row *instantly* to the subscribed client.
    *   UI updates automatically (React state adds the new message).
3.  **Notifications**:
    *   If recipient is offline or away, a `notification` is inserted to alert them of "New Message".

**Key Tables**: `messages`

---

## 5. Case Management Flow
**Goal**: Tracking the lifecycle of a legal case.

### The Flow
1.  **Creation**: Created automatically during **Booking** (`status='open'`).
2.  **Activation**: Becomes **`'in_progress'`** when payment is made.
3.  **Updates**:
    *   Lawyer updates status to **`'completed'`** or **`'closed'`** via Dashboard.
    *   **Action**: `supabase.from('cases').update({ status: '...' })`.
4.  **Visibility**:
    *   Filters on Client/Lawyer dashboards (`/client/cases`, `/lawyer/cases`) query this `status` column to sort Active vs Past work.

**Key Tables**: `cases`

---

## 6. Notification System Flow
**Goal**: Alert users to important events.

### The Flow
1.  **Trigger**: Events (Booking, Message, Payment) happen.
2.  **Creation**:
    *   **Action**: `supabase.from('notifications').insert(...)`.
    *   **Data**: `recipient_id`, `type`, `title`, `message`.
3.  **Delivery**:
    *   The `NotificationBell` component subscribes to `postgres_changes` on the `notifications` table.
    *   When a new row appears for the current user, the bell shows a red badge.
4.  **Read Status**:
    *   User opens dropdown -> `update notifications set is_read = true`.

**Key Tables**: `notifications`
