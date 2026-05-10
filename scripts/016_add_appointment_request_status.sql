-- =============================================
-- ADD REQUEST STATUS TO APPOINTMENTS
-- =============================================
-- This allows appointments to be in "pending" status
-- where lawyer can accept/reject before confirming

-- Add pending status to appointments
ALTER TABLE public.appointments 
DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE public.appointments
ADD CONSTRAINT appointments_status_check 
CHECK (status IN ('pending', 'scheduled', 'completed', 'cancelled', 'rescheduled', 'rejected'));

-- Update default status to pending for new requests
ALTER TABLE public.appointments
ALTER COLUMN status SET DEFAULT 'pending';

-- Add request message field for client to add notes
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS request_message TEXT;

-- Add response fields for lawyer
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS lawyer_response TEXT;
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS responded_at TIMESTAMP WITH TIME ZONE;

