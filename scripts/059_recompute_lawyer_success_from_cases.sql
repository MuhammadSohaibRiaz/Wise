-- 059 — Case-based lawyer success_rate + decouple review trigger from success_rate
-- Run AFTER 057 and 058.

CREATE OR REPLACE FUNCTION public.recompute_lawyer_success_from_cases(p_lawyer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  completed_count int;
  win_count int;
  new_rate numeric;
BEGIN
  SELECT COUNT(*)::int,
         COUNT(*) FILTER (WHERE case_outcome IN ('won', 'settled'))::int
  INTO completed_count, win_count
  FROM cases
  WHERE lawyer_id = p_lawyer_id
    AND status = 'completed';

  IF completed_count > 0 THEN
    new_rate := ROUND((win_count::numeric / completed_count::numeric) * 100, 2);
  ELSE
    new_rate := 0;
  END IF;

  UPDATE lawyer_profiles
  SET success_rate = new_rate,
      total_cases = completed_count,
      updated_at = now()
  WHERE id = p_lawyer_id;
END;
$$;

COMMENT ON FUNCTION public.recompute_lawyer_success_from_cases(uuid) IS
  'Sets lawyer_profiles.success_rate from completed case outcomes (won + settled) / total completed.';

CREATE OR REPLACE FUNCTION public.cases_recompute_lawyer_success_on_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.lawyer_id IS NOT NULL
     AND (
       (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed')
       OR (OLD.case_outcome IS DISTINCT FROM NEW.case_outcome AND NEW.status = 'completed')
     ) THEN
    PERFORM public.recompute_lawyer_success_from_cases(NEW.lawyer_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cases_recompute_lawyer_success ON public.cases;

CREATE TRIGGER trg_cases_recompute_lawyer_success
  AFTER UPDATE OF status, case_outcome ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION public.cases_recompute_lawyer_success_on_complete();

-- Reviews only update average_rating (not success_rate).
CREATE OR REPLACE FUNCTION recompute_lawyer_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_lawyer_id uuid;
  new_avg numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_lawyer_id := OLD.reviewee_id;
  ELSE
    target_lawyer_id := NEW.reviewee_id;
  END IF;

  SELECT COALESCE(AVG(rating), 0)
  INTO new_avg
  FROM reviews
  WHERE reviewee_id = target_lawyer_id
    AND status = 'published';

  UPDATE lawyer_profiles
  SET average_rating = ROUND(new_avg::numeric, 2)
  WHERE id = target_lawyer_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_lawyer_rating ON reviews;

CREATE TRIGGER trg_recompute_lawyer_rating
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION recompute_lawyer_rating();
