-- =============================================
-- OPTIONAL — WiseCase client dashboard live notifications
-- =============================================
-- You do **not** need any new script for the recent app features if you already
-- ran scripts 001–024: tables and columns used by the dashboard, matching,
-- reviews, and lawyer profiles already exist.
--
-- Run this script **only** if you want Supabase Realtime to broadcast INSERTs on
-- `public.notifications` so `/client/dashboard` updates without a manual refresh.
--
-- Alternative: Supabase Dashboard → Database → Replication → enable `notifications`.
--
-- If `notifications` is already in the `supabase_realtime` publication, Postgres may
-- respond with an error like "already member of publication" — that is safe to ignore.

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
