-- =============================================
-- 055 - Allow no-show closure (scheduled/rescheduled -> cancelled)
-- =============================================
-- Run in Supabase SQL editor after 054.
-- Required for POST /api/appointments/mark-no-show.

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

  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT c.status INTO linked_case_status
  FROM public.cases c
  WHERE c.id = NEW.case_id;

  IF OLD.status IN ('cancelled', 'rejected') THEN
    RAISE EXCEPTION 'appointments: cannot transition out of terminal status %', OLD.status;
  END IF;

  IF OLD.status = 'completed' AND NEW.status IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'appointments: cannot transition out of completed status';
  END IF;

  IF OLD.status = 'pending' AND NEW.status IN ('awaiting_payment', 'rejected', 'cancelled') THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'awaiting_payment' AND NEW.status IN ('scheduled', 'cancelled') THEN
    RETURN NEW;
  END IF;

  -- Paid consultations: attendance, reschedule, admin cancellation review, or no-show closure.
  IF OLD.status = 'scheduled' AND NEW.status IN ('attended', 'rescheduled', 'cancellation_requested', 'cancelled') THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'rescheduled' AND NEW.status IN ('attended', 'rescheduled', 'cancellation_requested', 'cancelled') THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'cancellation_requested' AND NEW.status IN ('cancelled', 'scheduled', 'rescheduled') THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'completed' AND linked_case_status = 'completed' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'appointments: invalid status transition % -> %', OLD.status, NEW.status;
END;
$$;

COMMENT ON FUNCTION public.appointments_enforce_status_transition() IS
  'WiseCase appointment lifecycle guard (055 adds cancelled from scheduled/rescheduled for no-show).';
