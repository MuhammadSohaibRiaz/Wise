-- =============================================
-- ADD AWAITING_PAYMENT STATUS TO APPOINTMENTS
-- =============================================
-- This allows appointments to be in "awaiting_payment" status
-- after lawyer approves but before client pays

-- Add awaiting_payment status to appointments
ALTER TABLE public.appointments 
DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE public.appointments
ADD CONSTRAINT appointments_status_check 
CHECK (status IN ('pending', 'awaiting_payment', 'scheduled', 'completed', 'cancelled', 'rescheduled', 'rejected'));

-- Add appointment_id reference to payments table
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payments_appointment_id ON public.payments(appointment_id);

