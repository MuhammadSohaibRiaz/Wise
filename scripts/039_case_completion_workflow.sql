-- =============================================
-- 039 — Case completion workflow (X1 / X3)
-- =============================================
-- Run in Supabase SQL Editor AFTER:
--   - 003_create_cases.sql
--   - 021_add_awaiting_payment_status.sql (appointment statuses)
--   - 029_add_pending_completion_status.sql (recommended: adds pending_completion on cases)
--
-- What this does:
--   1) Adds optional metadata columns on `cases` for who proposed completion and when.
--   2) Re-applies `cases_status_check` so `pending_completion` is always allowed (idempotent).
--   3) BEFORE UPDATE: stamps `completion_requested_*` when status becomes `pending_completion`;
--      clears them when returning to `in_progress` from `pending_completion`.
--   4) AFTER UPDATE: when a case becomes `completed`, marks related appointments as `completed`
--      (see also 042: add `attended` for “consultation held” vs this “closed with case”.)
--
-- Safe to re-run: uses IF NOT EXISTS / DROP IF EXISTS where appropriate.

-- ------------------------------------------------------------------
-- 1) Metadata columns on cases
-- ------------------------------------------------------------------
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS completion_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS completion_requested_by text;

COMMENT ON COLUMN public.cases.completion_requested_at IS
  'Set when the case moves to pending_completion (lawyer or client proposed closing).';
COMMENT ON COLUMN public.cases.completion_requested_by IS
  'Who proposed completion: lawyer | client. Cleared when request is withdrawn or rejected.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cases_completion_requested_by_check'
  ) THEN
    ALTER TABLE public.cases
      ADD CONSTRAINT cases_completion_requested_by_check
      CHECK (
        completion_requested_by IS NULL
        OR completion_requested_by IN ('lawyer', 'client')
      );
  END IF;
END $$;

-- ------------------------------------------------------------------
-- 2) Ensure case status constraint includes pending_completion
-- ------------------------------------------------------------------
ALTER TABLE public.cases DROP CONSTRAINT IF EXISTS cases_status_check;

ALTER TABLE public.cases
  ADD CONSTRAINT cases_status_check
  CHECK (status IN ('open', 'in_progress', 'pending_completion', 'completed', 'closed'));

COMMENT ON COLUMN public.cases.status IS
  'open → in_progress → pending_completion (proposal) → completed (confirmed), or closed.';

-- ------------------------------------------------------------------
-- 3) BEFORE UPDATE — completion request metadata
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cases_stamp_completion_request()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'pending_completion'
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.completion_requested_at := COALESCE(NEW.completion_requested_at, now());
    NEW.completion_requested_by := COALESCE(NEW.completion_requested_by, 'lawyer');
  END IF;

  IF NEW.status = 'in_progress'
     AND OLD.status = 'pending_completion'
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.completion_requested_at := NULL;
    NEW.completion_requested_by := NULL;
  END IF;

  IF NEW.status = 'completed'
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.completion_requested_at := NULL;
    NEW.completion_requested_by := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cases_stamp_completion_request ON public.cases;

CREATE TRIGGER cases_stamp_completion_request
  BEFORE UPDATE OF status ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION public.cases_stamp_completion_request();

-- ------------------------------------------------------------------
-- 4) AFTER UPDATE — sync appointments when case is completed
-- ------------------------------------------------------------------
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
