-- =============================================
-- 044 — Defense-in-depth: appointment status transitions
-- =============================================
-- Run in Supabase AFTER 042 (appointment statuses + case sync trigger).
--
-- Purpose:
--   Block absurd lifecycle jumps at the database layer (e.g. cancelled → pending)
--   while allowing all transitions used by the app, Stripe webhooks, and
--   `cases_sync_appointments_on_completed` (039/042).
--
-- Safe to re-run: replaces function + trigger only.

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
    (OLD.status = 'pending' AND NEW.status IN ('awaiting_payment', 'rejected', 'cancelled', 'scheduled', 'completed'))
    OR (OLD.status = 'awaiting_payment' AND NEW.status IN ('scheduled', 'cancelled', 'completed'))
    OR (OLD.status = 'scheduled' AND NEW.status IN ('attended', 'cancelled', 'rescheduled', 'completed'))
    OR (OLD.status = 'rescheduled' AND NEW.status IN ('attended', 'cancelled', 'rescheduled', 'completed'))
    OR (OLD.status = 'attended' AND NEW.status IN ('completed'))
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'appointments: invalid status transition % -> %', OLD.status, NEW.status;
END;
$$;

COMMENT ON FUNCTION public.appointments_enforce_status_transition() IS
  'Guards appointment.status updates to known WiseCase lifecycle transitions (UI + Stripe + case completion sync).';

DROP TRIGGER IF EXISTS appointments_status_transition_guard ON public.appointments;

CREATE TRIGGER appointments_status_transition_guard
  BEFORE UPDATE OF status ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.appointments_enforce_status_transition();
