-- Fix document_analysis table by adding missing AI analysis fields
ALTER TABLE public.document_analysis 
ADD COLUMN IF NOT EXISTS risk_level text,
ADD COLUMN IF NOT EXISTS urgency text,
ADD COLUMN IF NOT EXISTS seriousness text,
ADD COLUMN IF NOT EXISTS category text;

-- Add comments for clarity
COMMENT ON COLUMN public.document_analysis.risk_level IS 'AI assessed risk level (Low, Medium, High)';
COMMENT ON COLUMN public.document_analysis.urgency IS 'AI assessed urgency (Normal, Urgent, Immediate)';
COMMENT ON COLUMN public.document_analysis.seriousness IS 'AI assessed seriousness (Low, Moderate, Critical)';
COMMENT ON COLUMN public.document_analysis.category IS 'Identified legal specialization category';
