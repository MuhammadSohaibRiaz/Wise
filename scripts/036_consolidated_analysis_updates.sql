-- Consolidated migration for Pakistani Law Analysis and History Fixes
-- This script adds all missing columns required for the new AI analysis features.

ALTER TABLE public.document_analysis 
ADD COLUMN IF NOT EXISTS legal_citations text[],
ADD COLUMN IF NOT EXISTS disclaimer text,
ADD COLUMN IF NOT EXISTS risk_level text,
ADD COLUMN IF NOT EXISTS urgency text,
ADD COLUMN IF NOT EXISTS seriousness text,
ADD COLUMN IF NOT EXISTS category text;

-- Add comments for schema clarity
COMMENT ON COLUMN public.document_analysis.legal_citations IS 'Specific sections, acts, or articles from Pakistani Law identified by AI.';
COMMENT ON COLUMN public.document_analysis.disclaimer IS 'Mandatory legal disclaimer about the preliminary nature of analysis.';
COMMENT ON COLUMN public.document_analysis.risk_level IS 'AI assessed risk level (Low, Medium, High)';
COMMENT ON COLUMN public.document_analysis.urgency IS 'AI assessed urgency (Normal, Urgent, Immediate)';
COMMENT ON COLUMN public.document_analysis.seriousness IS 'AI assessed seriousness (Low, Moderate, Critical)';
COMMENT ON COLUMN public.document_analysis.category IS 'Identified legal specialization category';
