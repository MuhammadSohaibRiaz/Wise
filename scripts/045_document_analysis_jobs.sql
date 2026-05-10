-- =============================================
-- 045 — Async document analysis job queue (Phase 3)
-- =============================================
-- Run in Supabase AFTER 043 (timeline / drafts ecosystem stable).

CREATE TABLE IF NOT EXISTS public.document_analysis_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message text,
  result_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS document_analysis_jobs_doc_idx ON public.document_analysis_jobs (document_id);
CREATE INDEX IF NOT EXISTS document_analysis_jobs_status_idx ON public.document_analysis_jobs (status, created_at);

ALTER TABLE public.document_analysis_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "document_analysis_jobs_select_own_or_admin" ON public.document_analysis_jobs;
CREATE POLICY "document_analysis_jobs_select_own_or_admin"
  ON public.document_analysis_jobs FOR SELECT TO authenticated
  USING (
    requested_by = auth.uid() OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "document_analysis_jobs_insert_own" ON public.document_analysis_jobs;
CREATE POLICY "document_analysis_jobs_insert_own"
  ON public.document_analysis_jobs FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid());

COMMENT ON TABLE public.document_analysis_jobs IS
  'Queued AI document analysis; processed by cron/service-role worker (Phase 3).';
