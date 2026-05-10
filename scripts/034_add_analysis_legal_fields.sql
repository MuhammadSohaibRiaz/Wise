-- Add Pakistani Law specific fields to document_analysis
ALTER TABLE public.document_analysis 
ADD COLUMN IF NOT EXISTS legal_citations text[],
ADD COLUMN IF NOT EXISTS disclaimer text;

-- Add comment for clarity
COMMENT ON COLUMN public.document_analysis.legal_citations IS 'Specific sections, acts, or articles from Pakistani Law identified by AI.';
COMMENT ON COLUMN public.document_analysis.disclaimer IS 'Mandatory legal disclaimer about the preliminary nature of analysis.';
