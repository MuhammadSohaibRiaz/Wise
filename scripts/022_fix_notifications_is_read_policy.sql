-- =============================================
-- FIX NOTIFICATIONS IS_READ POLICY
-- =============================================
-- Adds missing RLS policy for is_read updates
-- This allows users to mark their notifications as read

-- Drop existing update policy if it exists
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;

-- Create comprehensive update policy that allows is_read updates
CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add comment for clarity
COMMENT ON POLICY "notifications_update_own" ON public.notifications IS
  'Allows users to update their own notifications, including is_read status';

