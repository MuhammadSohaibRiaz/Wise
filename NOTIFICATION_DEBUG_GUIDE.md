# Notification Debugging Guide

## How to Test Notifications

### 1. Check Realtime is Enabled

Go to Supabase Dashboard > Database > Replication and ensure:
- ✅ `notifications` table has Realtime enabled
- ✅ `appointments` table has Realtime enabled (for status updates)

### 2. Test Payment Notifications

#### Method 1: Complete a Payment
1. Client books appointment → Status: `pending`
2. Lawyer accepts → Status: `awaiting_payment` (notification sent to client)
3. Client pays → Status: `scheduled` (notifications sent to both client and lawyer)

#### Method 2: Create Test Notification Manually

Run this in Supabase SQL Editor:

```sql
-- Create a test notification for your user
INSERT INTO public.notifications (
  user_id,
  type,
  title,
  description,
  data
) VALUES (
  'YOUR_USER_ID_HERE',  -- Replace with your actual user ID
  'system',
  'Test Notification',
  'This is a test notification to verify the system is working',
  '{"test": true}'::jsonb
);
```

### 3. Check Browser Console

Open browser console (F12) and look for:

```
[Notifications] Initializing notification bell...
[Notifications] User authenticated: <user-id>
[Notifications] Loading notifications for user: <user-id>
[Notifications] Loaded X notifications
[Notifications] Unread count: X
[Notifications] ✅ Successfully subscribed to notifications for user <user-id>
```

### 4. Check Server Logs (Terminal)

When a notification is created, you should see in the terminal:

```
[Stripe] Payment succeeded for appointment <appointment-id>
```

### 5. Test Notification Creation

#### Test Payment Success Notification:

1. Complete a payment
2. Check Supabase Dashboard > Table Editor > `notifications`
3. You should see new rows with:
   - `type`: `payment_update`
   - `title`: `Payment Successful` (for client) or `Payment Received` (for lawyer)
   - `user_id`: Should match the client/lawyer ID

#### Test System Notification:

Create a system notification manually:

```sql
INSERT INTO public.notifications (
  user_id,
  type,
  title,
  description
) VALUES (
  'YOUR_USER_ID',
  'system',
  'System Test',
  'This is a system notification test'
);
```

### 6. Common Issues

#### Issue: Notifications not appearing
**Solution:**
1. Check Realtime is enabled on `notifications` table
2. Check browser console for subscription status
3. Verify `user_id` matches your current user ID
4. Check if notifications exist in database but aren't showing (RLS policy issue)

#### Issue: Subscription not working
**Solution:**
1. Check browser console for: `[Notifications] ✅ Successfully subscribed`
2. If you see `CHANNEL_ERROR`, check Supabase Realtime is enabled
3. Check network tab for WebSocket connections

#### Issue: Notifications created but not showing
**Solution:**
1. Check RLS policies allow user to read their own notifications
2. Verify `is_read` status
3. Check notification bell component is loading notifications

### 7. Debugging Commands

#### Check Your User ID:
```javascript
// In browser console
const { data: { user } } = await supabase.auth.getUser()
console.log('User ID:', user.id)
```

#### Check Notifications in Database:
```sql
-- Get all notifications for your user
SELECT * FROM public.notifications 
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 10;
```

#### Check Unread Count:
```sql
-- Count unread notifications
SELECT COUNT(*) FROM public.notifications 
WHERE user_id = 'YOUR_USER_ID' 
AND is_read = false;
```

### 8. Notification Types

The system supports these notification types:
- `system` - System notifications
- `message` - New messages
- `appointment_request` - New appointment requests
- `appointment_update` - Appointment status changes
- `case_update` - Case status changes
- `payment_update` - Payment status changes

### 9. Real-time Testing

1. Open two browser windows:
   - Window 1: Client account
   - Window 2: Lawyer account

2. In Window 2 (Lawyer), accept an appointment
3. In Window 1 (Client), the notification should appear immediately without refresh

4. In Window 1 (Client), complete payment
5. In Window 2 (Lawyer), the notification should appear immediately

### 10. Manual Notification Creation for Testing

You can create notifications manually using the Supabase SQL Editor:

```sql
-- Payment success notification
INSERT INTO public.notifications (
  user_id,
  type,
  title,
  description,
  data
) VALUES (
  'CLIENT_USER_ID',
  'payment_update',
  'Payment Successful',
  'Your payment has been confirmed.',
  '{"appointment_id": "xxx", "payment_id": "yyy"}'::jsonb
);

-- System notification
INSERT INTO public.notifications (
  user_id,
  type,
  title,
  description
) VALUES (
  'USER_ID',
  'system',
  'System Alert',
  'This is a system notification'
);
```

## Quick Debug Checklist

- [ ] Realtime enabled on `notifications` table
- [ ] Browser console shows subscription success
- [ ] Notifications exist in database
- [ ] RLS policies allow reading notifications
- [ ] Notification bell component is mounted
- [ ] User ID matches notification `user_id`
- [ ] No errors in browser console
- [ ] WebSocket connection active (check Network tab)

