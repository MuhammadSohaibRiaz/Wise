-- 058 — Persist message on cancellation support requests
-- Run AFTER 057, BEFORE 059.

ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS cancellation_request_message text;

COMMENT ON COLUMN public.appointments.cancellation_request_message IS
  'Message submitted with Contact Support cancellation request for admin review.';
