  -- =============================================
  -- 047 — Require at least one attended consultation before case completion
  -- =============================================
  -- Run in Supabase AFTER 042 (attended status) and 039 (case completion workflow).
  --
  -- Enforces the correct lifecycle:
  --   scheduled → attended → case work continues
  --   → lawyer requests completion (pending_completion)
  --   → client confirms (completed)
  --   → review becomes available
  --
  -- Guards:
  --   1) Case cannot move to `pending_completion` unless at least one
  --      appointment for that case has status `attended` or `completed`.
  --   2) Case cannot jump directly to `completed` without passing through
  --      `pending_completion` (unless moved from `pending_completion`).
  --
  -- Safe to re-run: replaces function + trigger only.

  CREATE OR REPLACE FUNCTION public.cases_require_attended_before_completion()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $$
  DECLARE
    attended_count integer;
  BEGIN
    IF TG_OP <> 'UPDATE' THEN
      RETURN NEW;
    END IF;

    IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
      RETURN NEW;
    END IF;

    -- Guard 1: pending_completion requires at least one attended/completed appointment
    IF NEW.status = 'pending_completion' THEN
      SELECT count(*) INTO attended_count
      FROM public.appointments
      WHERE case_id = NEW.id
        AND status IN ('attended', 'completed');

      IF attended_count = 0 THEN
        RAISE EXCEPTION 'cases: cannot request completion — no consultation has been marked as held (attended) yet';
      END IF;
    END IF;

    -- Guard 2: completed must come from pending_completion (client confirmation)
    IF NEW.status = 'completed' AND OLD.status <> 'pending_completion' THEN
      RAISE EXCEPTION 'cases: completion must go through pending_completion (lawyer request → client confirm)';
    END IF;

    RETURN NEW;
  END;
  $$;

  COMMENT ON FUNCTION public.cases_require_attended_before_completion() IS
    'Enforces that at least one consultation was attended before a case can be closed, and that completion goes through the handshake flow.';

  DROP TRIGGER IF EXISTS cases_require_attended_before_completion ON public.cases;

  CREATE TRIGGER cases_require_attended_before_completion
    BEFORE UPDATE OF status ON public.cases
    FOR EACH ROW
    EXECUTE FUNCTION public.cases_require_attended_before_completion();
