-- 060 — Enable Supabase Realtime on appointments (optional but recommended)
-- Run in Supabase SQL editor if client appointment list does not live-update.
-- Safe to re-run: ignore "already member of publication" if present.

ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
