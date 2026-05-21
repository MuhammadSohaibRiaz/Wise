-- 062 — Track who submitted a paid-appointment cancellation request (client vs lawyer)
-- Run in Supabase SQL editor after 058.

ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS cancellation_requested_by text;

COMMENT ON COLUMN public.appointments.cancellation_requested_by IS
  'Who submitted the cancellation support request: client or lawyer. Cleared when admin resolves.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'appointments_cancellation_requested_by_check'
  ) THEN
    ALTER TABLE public.appointments
    ADD CONSTRAINT appointments_cancellation_requested_by_check
    CHECK (
      cancellation_requested_by IS NULL
      OR cancellation_requested_by IN ('client', 'lawyer')
    );
  END IF;
END $$;
