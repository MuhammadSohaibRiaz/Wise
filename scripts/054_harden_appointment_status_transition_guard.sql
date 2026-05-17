-- =============================================
-- 054 - Harden appointment status transitions
-- =============================================
-- Run in Supabase SQL editor after 053.
--
-- Purpose:
--   The app now uses explicit server routes for each lifecycle action. This
--   trigger blocks direct participant updates that would skip lawyer approval,
--   payment, attendance, admin cancellation review, or case completion.
--
-- Safe to re-run.

CREATE OR REPLACE FUNCTION public.appointments_enforce_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  linked_case_status text;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- Allow updates that do not change lifecycle status (e.g. notes,
  -- scheduled_at while status stays the same, previous_status cleanup).
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT c.status INTO linked_case_status
  FROM public.cases c
  WHERE c.id = NEW.case_id;

  -- Terminal appointment outcomes cannot be revived.
  IF OLD.status IN ('cancelled', 'rejected') THEN
    RAISE EXCEPTION 'appointments: cannot transition out of terminal status %', OLD.status;
  END IF;

  IF OLD.status = 'completed' AND NEW.status IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'appointments: cannot transition out of completed status';
  END IF;

  -- Lawyer response flow.
  IF OLD.status = 'pending' AND NEW.status IN ('awaiting_payment', 'rejected', 'cancelled') THEN
    RETURN NEW;
  END IF;

  -- Client payment flow. Payment schedules the consultation; cancellation before
  -- payment is still allowed.
  IF OLD.status = 'awaiting_payment' AND NEW.status IN ('scheduled', 'cancelled') THEN
    RETURN NEW;
  END IF;

  -- Reschedule / cancellation-review / attendance flow for paid appointments.
  IF OLD.status = 'scheduled' AND NEW.status IN ('attended', 'rescheduled', 'cancellation_requested') THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'rescheduled' AND NEW.status IN ('attended', 'rescheduled', 'cancellation_requested') THEN
    RETURN NEW;
  END IF;

  -- Admin rejection restores the exact pre-review active status.
  IF OLD.status = 'cancellation_requested' AND NEW.status IN ('cancelled', 'scheduled', 'rescheduled') THEN
    RETURN NEW;
  END IF;

  -- Appointments only become completed as part of confirmed case completion.
  -- The case completion trigger updates these rows after case.status becomes
  -- completed, so checking the linked case status keeps this path available
  -- while blocking direct "consultation done = completed" updates.
  IF NEW.status = 'completed' AND linked_case_status = 'completed' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'appointments: invalid status transition % -> %', OLD.status, NEW.status;
END;
$$;

COMMENT ON FUNCTION public.appointments_enforce_status_transition() IS
  'Strict WiseCase appointment lifecycle guard: request -> payment -> scheduled/rescheduled -> attended -> completed only after case completion.';

DROP TRIGGER IF EXISTS appointments_status_transition_guard ON public.appointments;

CREATE TRIGGER appointments_status_transition_guard
  BEFORE UPDATE OF status ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.appointments_enforce_status_transition();
