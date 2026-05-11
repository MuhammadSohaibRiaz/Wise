-- Migration: Make documents.case_id nullable so documents can exist independently
-- (before being linked to a real case via booking).
-- This eliminates the need for the "AI Analysis Documents" placeholder case pattern.

ALTER TABLE public.documents ALTER COLUMN case_id DROP NOT NULL;

-- Update RLS: documents with no case_id are readable by their uploader
DROP POLICY IF EXISTS "documents_select_own" ON public.documents;

CREATE POLICY "documents_select_own"
  ON public.documents FOR SELECT
  USING (
    auth.uid() = uploaded_by
    OR (
      case_id IS NOT NULL
      AND auth.uid() IN (
        SELECT client_id FROM public.cases WHERE id = case_id
        UNION
        SELECT lawyer_id FROM public.cases WHERE id = case_id
      )
    )
  );

-- Clean up: delete orphan "AI Analysis Documents" placeholder cases that have no
-- real appointments or payments. We first detach any documents from them (set case_id = NULL),
-- then delete the empty shell cases.
UPDATE public.documents
SET    case_id = NULL
WHERE  case_id IN (
  SELECT id FROM public.cases WHERE title = 'AI Analysis Documents'
);

DELETE FROM public.cases WHERE title = 'AI Analysis Documents';
