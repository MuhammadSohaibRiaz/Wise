-- =============================================
-- 051 — Case status transition guard + lifecycle repair
-- =============================================
-- Run in Supabase SQL editor after 050.
--
-- Purpose:
--   Keep case.status aligned with appointment lifecycle:
--   open -> in_progress only after at least one consultation is held
--   in_progress -> pending_completion only after held consultation
--   pending_completion -> completed only after client confirmation flow
--
-- Safe to re-run.

-- Repair historical rows created by earlier payment flow:
-- payment scheduled the consultation, but the consultation was not held yet.
UPDATE public.cases AS c
SET status = 'open',
    updated_at = now()
WHERE c.status IN ('in_progress', 'pending_completion')
  AND NOT EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.case_id = c.id
      AND a.status IN ('attended', 'completed')
  );

CREATE OR REPLACE FUNCTION public.cases_enforce_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  has_held_consultation boolean;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.case_id = NEW.id
      AND a.status IN ('attended', 'completed')
  ) INTO has_held_consultation;

  IF OLD.status = 'closed' AND NEW.status <> 'closed' THEN
    RAISE EXCEPTION 'cases: cannot transition out of closed status';
  END IF;

  IF NEW.status = 'open' AND OLD.status <> 'open' THEN
    RAISE EXCEPTION 'cases: cannot revert an active case back to open';
  END IF;

  IF NEW.status IN ('in_progress', 'pending_completion') AND NOT has_held_consultation THEN
    RAISE EXCEPTION 'cases: cannot move to % before a consultation is marked held', NEW.status;
  END IF;

  IF NEW.status = 'completed' AND OLD.status <> 'pending_completion' THEN
    RAISE EXCEPTION 'cases: completed requires pending_completion first';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.cases_enforce_status_transition() IS
  'Guards case.status so active/completion states require a held consultation and valid completion flow.';

DROP TRIGGER IF EXISTS cases_status_transition_guard ON public.cases;

CREATE TRIGGER cases_status_transition_guard
  BEFORE UPDATE OF status ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION public.cases_enforce_status_transition();
