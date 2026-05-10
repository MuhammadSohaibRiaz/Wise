-- =============================================
-- 042 — Appointment status: `attended` (consultation held) vs `completed` (closed with case)
-- =============================================
-- Run in Supabase AFTER 021 (appointment statuses) and ideally after 039 (case completion trigger).
--
-- Semantics:
--   `scheduled`     — paid/booked, consultation not yet held (or upcoming slot).
--   `attended`      — consultation session took place; use for billing / “session done”.
--   `completed`     — appointment row aligned with **case** closure (set by trigger when case → completed),
--                     or legacy data; do NOT use `completed` on appointments to mean “just paid”.
--
-- This migration:
--   1) Adds `attended` to appointments_status_check.
--   2) Rewrites bad legacy rows: `completed` + active case + future slot → `scheduled`;
--      `completed` + active case + past slot → `attended`.
--   3) Replaces `cases_sync_appointments_on_completed` so closing a case also closes rows in
--      `scheduled`, `attended`, etc. (not only `scheduled`).
--
-- Safe to re-run: constraint drop/add is idempotent; updates are bounded by conditions.

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (
    status IN (
      'pending',
      'awaiting_payment',
      'scheduled',
      'attended',
      'completed',
      'cancelled',
      'rescheduled',
      'rejected'
    )
  );

COMMENT ON COLUMN public.appointments.status IS
  'scheduled = upcoming consult; attended = session held (billable); completed = closed with case (sync from cases); cancelled/rejected/rescheduled as usual.';

-- Legacy repair (same intent as 041, extended for `attended`)
UPDATE public.appointments AS a
SET
  status = 'scheduled',
  updated_at = now()
FROM public.cases AS c
WHERE a.case_id = c.id
  AND a.status = 'completed'
  AND c.status NOT IN ('completed', 'closed')
  AND a.scheduled_at > now();

UPDATE public.appointments AS a
SET
  status = 'attended',
  updated_at = now()
FROM public.cases AS c
WHERE a.case_id = c.id
  AND a.status = 'completed'
  AND c.status NOT IN ('completed', 'closed')
  AND a.scheduled_at <= now();

-- When the case is confirmed completed, close related appointment rows (include `attended`)
CREATE OR REPLACE FUNCTION public.cases_sync_appointments_on_completed()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'completed'
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.appointments
    SET
      status = 'completed',
      updated_at = now()
    WHERE case_id = NEW.id
      AND status IN ('pending', 'awaiting_payment', 'scheduled', 'rescheduled', 'attended');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cases_sync_appointments_on_completed ON public.cases;

CREATE TRIGGER cases_sync_appointments_on_completed
  AFTER UPDATE OF status ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION public.cases_sync_appointments_on_completed();
