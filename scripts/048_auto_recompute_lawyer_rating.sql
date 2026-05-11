-- 048: Auto-recompute lawyer average_rating when a review is inserted/updated/deleted.
-- This runs as a DB trigger with SECURITY DEFINER, bypassing RLS so the client
-- user's session doesn't need UPDATE access on lawyer_profiles.

CREATE OR REPLACE FUNCTION recompute_lawyer_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_lawyer_id uuid;
  new_avg numeric;
  new_count int;
BEGIN
  -- Determine which lawyer to recompute for
  IF TG_OP = 'DELETE' THEN
    target_lawyer_id := OLD.reviewee_id;
  ELSE
    target_lawyer_id := NEW.reviewee_id;
  END IF;

  -- Recompute from all published reviews
  SELECT COALESCE(AVG(rating), 0), COUNT(*)
  INTO new_avg, new_count
  FROM reviews
  WHERE reviewee_id = target_lawyer_id
    AND status = 'published';

  UPDATE lawyer_profiles
  SET average_rating = ROUND(new_avg::numeric, 2),
      success_rate   = ROUND((new_avg / 5.0) * 100, 2),
      total_cases    = GREATEST(total_cases, new_count)
  WHERE id = target_lawyer_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop if exists to allow re-run
DROP TRIGGER IF EXISTS trg_recompute_lawyer_rating ON reviews;

CREATE TRIGGER trg_recompute_lawyer_rating
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION recompute_lawyer_rating();
