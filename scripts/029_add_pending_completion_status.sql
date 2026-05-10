-- =============================================
-- ADD PENDING_COMPLETION STATUS TO CASES
-- =============================================
-- This allows lawyers to request case completion
-- which must then be confirmed by the client.

-- Update cases status check constraint
ALTER TABLE public.cases 
DROP CONSTRAINT IF EXISTS cases_status_check;

ALTER TABLE public.cases
ADD CONSTRAINT cases_status_check 
CHECK (status IN ('open', 'in_progress', 'pending_completion', 'completed', 'closed'));

-- Add comment for clarity
COMMENT ON COLUMN public.cases.status IS 'Status of the case: open, in_progress, pending_completion (requested by lawyer), completed (confirmed by client), or closed.';
