-- =============================================
-- 052 — Case document notes and comments.
-- =============================================
-- Run in Supabase SQL editor after 051.
--
-- Purpose:
--   - Uploaders can keep one private note on their own uploaded document.
--   - The other case participant can comment on documents they did not upload.
--
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.case_document_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id, user_id)
);

CREATE INDEX IF NOT EXISTS case_document_notes_document_idx
  ON public.case_document_notes (document_id);

ALTER TABLE public.case_document_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "case_document_notes_select_own" ON public.case_document_notes;
CREATE POLICY "case_document_notes_select_own"
  ON public.case_document_notes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "case_document_notes_insert_own_uploaded_doc" ON public.case_document_notes;
CREATE POLICY "case_document_notes_insert_own_uploaded_doc"
  ON public.case_document_notes FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.documents d
      WHERE d.id = document_id
        AND d.uploaded_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "case_document_notes_update_own_uploaded_doc" ON public.case_document_notes;
CREATE POLICY "case_document_notes_update_own_uploaded_doc"
  ON public.case_document_notes FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.documents d
      WHERE d.id = document_id
        AND d.uploaded_by = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS public.case_document_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  comment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS case_document_comments_document_created_idx
  ON public.case_document_comments (document_id, created_at DESC);

ALTER TABLE public.case_document_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "case_document_comments_select_case_participants" ON public.case_document_comments;
CREATE POLICY "case_document_comments_select_case_participants"
  ON public.case_document_comments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.documents d
      JOIN public.cases c ON c.id = d.case_id
      WHERE d.id = document_id
        AND (auth.uid() = c.client_id OR auth.uid() = c.lawyer_id)
    )
  );

DROP POLICY IF EXISTS "case_document_comments_insert_on_others_docs" ON public.case_document_comments;
CREATE POLICY "case_document_comments_insert_on_others_docs"
  ON public.case_document_comments FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.documents d
      JOIN public.cases c ON c.id = d.case_id
      WHERE d.id = document_id
        AND d.uploaded_by <> auth.uid()
        AND (auth.uid() = c.client_id OR auth.uid() = c.lawyer_id)
    )
  );
