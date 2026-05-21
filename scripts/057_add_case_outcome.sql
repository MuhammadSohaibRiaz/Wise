-- 057 — Case outcome on completion (won / lost / settled / ongoing)
-- Run in Supabase SQL editor FIRST (before 058 and 059).

ALTER TABLE public.cases
ADD COLUMN IF NOT EXISTS case_outcome text;

ALTER TABLE public.cases
DROP CONSTRAINT IF EXISTS cases_case_outcome_check;

ALTER TABLE public.cases
ADD CONSTRAINT cases_case_outcome_check
CHECK (case_outcome IS NULL OR case_outcome IN ('won', 'lost', 'settled', 'ongoing'));

COMMENT ON COLUMN public.cases.case_outcome IS
  'Client-reported outcome when confirming case completion: won, lost, settled, or ongoing.';
