-- Optional lawyer-only notes on cases (used by lawyer case detail UI).
-- Run after core cases migration (003) if the column is missing.

ALTER TABLE public.cases
ADD COLUMN IF NOT EXISTS private_notes text;

COMMENT ON COLUMN public.cases.private_notes IS 'Internal notes visible only to the assigned lawyer (not shown to client).';
