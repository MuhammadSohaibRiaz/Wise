-- =============================================
-- 050 — Add reschedule_count + previous_status + update transition guard
-- =============================================
-- Run in Supabase SQL editor AFTER all prior migrations.
--
-- 1. Adds reschedule_count column to appointments (tracks how many times rescheduled, max 3).
-- 2. Adds previous_status column (stores status before cancellation_requested, restored on admin rejection).
-- 3. Updates the status transition guard to allow cancellation_requested flows.
--
-- Safe to re-run: uses IF NOT EXISTS and CREATE OR REPLACE.

-- ─── Part A: Add reschedule_count column ───
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS reschedule_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.appointments.reschedule_count IS
  'Number of times this appointment has been rescheduled. Max 3 allowed by app logic.';

-- ─── Part A2: Add previous_status column ───
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS previous_status text;

COMMENT ON COLUMN public.appointments.previous_status IS
  'Stores the status before transitioning to cancellation_requested. Used to restore correct status on admin rejection.';

-- ─── Part B: Update CHECK constraint to allow cancellation_requested ───
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
      'rejected',
      'cancellation_requested'
    )
  );

-- ─── Part C: Update transition guard to support cancellation_requested ───
CREATE OR REPLACE FUNCTION public.appointments_enforce_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- Allow updates that do not change lifecycle status (e.g. reschedule time-only,
  -- notes, responded_at).
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Terminal appointment outcomes from the lawyer/client flows (cannot revive).
  IF OLD.status IN ('cancelled', 'rejected') THEN
    RAISE EXCEPTION 'appointments: cannot transition out of terminal status %', OLD.status;
  END IF;

  -- Case closure sync marks related appointment rows completed (042).
  IF OLD.status = 'completed' AND NEW.status IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'appointments: cannot transition out of completed status';
  END IF;

  IF (
    (OLD.status = 'pending'                AND NEW.status IN ('awaiting_payment', 'rejected', 'cancelled', 'scheduled', 'completed'))
    OR (OLD.status = 'awaiting_payment'    AND NEW.status IN ('scheduled', 'cancelled', 'completed'))
    OR (OLD.status = 'scheduled'           AND NEW.status IN ('attended', 'cancelled', 'rescheduled', 'completed', 'cancellation_requested'))
    OR (OLD.status = 'rescheduled'         AND NEW.status IN ('attended', 'cancelled', 'rescheduled', 'completed', 'cancellation_requested'))
    OR (OLD.status = 'attended'            AND NEW.status IN ('completed'))
    OR (OLD.status = 'cancellation_requested' AND NEW.status IN ('cancelled', 'scheduled', 'rescheduled'))
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'appointments: invalid status transition % -> %', OLD.status, NEW.status;
END;
$$;

COMMENT ON FUNCTION public.appointments_enforce_status_transition() IS
  'Guards appointment.status updates to known WiseCase lifecycle transitions (UI + Stripe + case completion sync + cancellation requests).';
