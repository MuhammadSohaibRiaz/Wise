# Supabase Realtime Setup Guide

## ✅ Already Enabled
- **Messages Table** - Realtime is enabled (you mentioned you just enabled it)

## ⚠️ Need to Enable

### 1. Notifications Table
To enable real-time notifications, you need to enable Realtime on the `notifications` table:

1. Go to your Supabase Dashboard
2. Navigate to **Database** > **Replication**
3. Find the `notifications` table
4. Toggle **Enable Realtime** to ON
5. Click **Save**

### 2. Appointments Table (Optional but Recommended)
For real-time appointment status updates:

1. Go to **Database** > **Replication**
2. Find the `appointments` table
3. Toggle **Enable Realtime** to ON
4. Click **Save**

## How to Verify

After enabling Realtime:

1. **Test Notifications:**
   - Create a notification in your database
   - It should appear in the notification bell dropdown immediately (no refresh needed)

2. **Test Appointments:**
   - Update an appointment status (e.g., from `pending` to `awaiting_payment`)
   - The status badge should update immediately on both client and lawyer dashboards

## Current Implementation

The code already has real-time subscriptions set up for:
- ✅ Messages (working - you enabled it)
- ✅ Notifications (ready - just needs Realtime enabled)
- ✅ Appointments (ready - just needs Realtime enabled)

## Troubleshooting

If notifications still don't appear:

1. **Check Realtime is enabled** on the `notifications` table
2. **Check browser console** for any subscription errors
3. **Verify RLS policies** allow the user to read their own notifications
4. **Check network tab** for WebSocket connections to Supabase

## Quick SQL Check

You can verify Realtime is enabled by running this in Supabase SQL Editor:

```sql
-- Check if Realtime is enabled for notifications
SELECT 
  schemaname,
  tablename,
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'notifications'
    ) THEN 'Enabled'
    ELSE 'Disabled'
  END as realtime_status
FROM pg_tables
WHERE schemaname = 'public' 
AND tablename = 'notifications';
```

If it shows "Disabled", enable it via the Dashboard as described above.

