-- =============================================
-- 043 — Phase 1: Case-centric foundation (ADDITIVE)
-- =============================================
-- Run in Supabase SQL Editor AFTER 042 (and full chain 001–042 as applicable).
--
-- Deliberately does NOT (yet):
--   - Rename case/appointment/payment status values (breaks running app)
--   - Remove awaiting_payment, verify-payment route, or Stripe Payment Intent
--   - Make documents.case_id nullable (current app uses a placeholder case for analysis)
--
-- Adds:
--   - case_drafts (replaces long-term dependence on sessionStorage; works with existing docs)
--   - case_timeline_events (audit / viva / workspace)
--   - ai_security_logs (prompt-injection / abuse logging)
--   - document_analysis metadata columns (confidence, model, timing, language)
--   - lawyer_profiles.trust_score + verification_confidence
--   - payments.stripe_checkout_session_id (optional metadata for Checkout)
--
-- Safe to re-run: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.

-- ------------------------------------------------------------------
-- 1) case_drafts
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.case_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text,
  draft_status text NOT NULL DEFAULT 'draft'
    CHECK (draft_status IN ('draft', 'ready_to_book', 'converted')),
  linked_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  linked_analysis_id uuid REFERENCES public.document_analysis(id) ON DELETE SET NULL,
  selected_lawyer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS case_drafts_client_id_idx ON public.case_drafts (client_id);
CREATE INDEX IF NOT EXISTS case_drafts_document_idx ON public.case_drafts (linked_document_id);

-- One draft row per client+document (latest wins on upsert from app)
CREATE UNIQUE INDEX IF NOT EXISTS case_drafts_client_document_uidx
  ON public.case_drafts (client_id, linked_document_id)
  WHERE linked_document_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_case_drafts_updated_at ON public.case_drafts;
CREATE TRIGGER trg_case_drafts_updated_at
  BEFORE UPDATE ON public.case_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.case_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "case_drafts_select_own" ON public.case_drafts;
CREATE POLICY "case_drafts_select_own"
  ON public.case_drafts FOR SELECT TO authenticated
  USING (auth.uid() = client_id);

DROP POLICY IF EXISTS "case_drafts_insert_own" ON public.case_drafts;
CREATE POLICY "case_drafts_insert_own"
  ON public.case_drafts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = client_id);

DROP POLICY IF EXISTS "case_drafts_update_own" ON public.case_drafts;
CREATE POLICY "case_drafts_update_own"
  ON public.case_drafts FOR UPDATE TO authenticated
  USING (auth.uid() = client_id);

DROP POLICY IF EXISTS "case_drafts_delete_own" ON public.case_drafts;
CREATE POLICY "case_drafts_delete_own"
  ON public.case_drafts FOR DELETE TO authenticated
  USING (auth.uid() = client_id);

COMMENT ON TABLE public.case_drafts IS
  'Pre-booking workspace: links client + analyzed document + optional lawyer pick; replaces fragile session-only state.';

-- ------------------------------------------------------------------
-- 2) case_timeline_events
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.case_timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS case_timeline_case_id_idx ON public.case_timeline_events (case_id, created_at DESC);

ALTER TABLE public.case_timeline_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "case_timeline_select_participants" ON public.case_timeline_events;
CREATE POLICY "case_timeline_select_participants"
  ON public.case_timeline_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_id
        AND (auth.uid() = c.client_id OR auth.uid() = c.lawyer_id OR public.is_admin(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "case_timeline_insert_participants" ON public.case_timeline_events;
CREATE POLICY "case_timeline_insert_participants"
  ON public.case_timeline_events FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_id
        AND (auth.uid() = c.client_id OR auth.uid() = c.lawyer_id OR public.is_admin(auth.uid()))
    )
    AND (actor_id IS NULL OR actor_id = auth.uid() OR public.is_admin(auth.uid()))
  );

COMMENT ON TABLE public.case_timeline_events IS
  'Append-only case activity feed for workspace UX and audits.';

-- ------------------------------------------------------------------
-- 3) ai_security_logs
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_security_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  detected_attack_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'low', 'medium', 'high')),
  raw_excerpt text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_security_logs_doc_idx ON public.ai_security_logs (document_id);
CREATE INDEX IF NOT EXISTS ai_security_logs_created_idx ON public.ai_security_logs (created_at DESC);

ALTER TABLE public.ai_security_logs ENABLE ROW LEVEL SECURITY;

-- Users see own logs; admins see all (reuse is_admin from 033)
DROP POLICY IF EXISTS "ai_security_logs_select_own_or_admin" ON public.ai_security_logs;
CREATE POLICY "ai_security_logs_select_own_or_admin"
  ON public.ai_security_logs FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id OR public.is_admin(auth.uid())
  );

-- Inserts happen server-side with service role / bypass — authenticated insert for API using user session:
DROP POLICY IF EXISTS "ai_security_logs_insert_own" ON public.ai_security_logs;
CREATE POLICY "ai_security_logs_insert_own"
  ON public.ai_security_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.ai_security_logs IS
  'Heuristic detections (e.g. prompt-injection phrases) on document analysis path.';

-- ------------------------------------------------------------------
-- 4) document_analysis — metadata (additive)
-- ------------------------------------------------------------------
ALTER TABLE public.document_analysis
  ADD COLUMN IF NOT EXISTS confidence_score numeric(5, 4),
  ADD COLUMN IF NOT EXISTS detected_language text,
  ADD COLUMN IF NOT EXISTS processing_time_ms integer,
  ADD COLUMN IF NOT EXISTS ai_model_version text;

COMMENT ON COLUMN public.document_analysis.confidence_score IS 'Model-reported 0–1 confidence in legal classification / extraction.';
COMMENT ON COLUMN public.document_analysis.processing_time_ms IS 'End-to-end processing time for this analysis request.';

-- ------------------------------------------------------------------
-- 5) lawyer_profiles — trust (additive)
-- ------------------------------------------------------------------
ALTER TABLE public.lawyer_profiles
  ADD COLUMN IF NOT EXISTS trust_score smallint,
  ADD COLUMN IF NOT EXISTS verification_confidence numeric(5, 4);

COMMENT ON COLUMN public.lawyer_profiles.trust_score IS '0–100 composite; computed in app, not a DB trigger.';
COMMENT ON COLUMN public.lawyer_profiles.verification_confidence IS 'Optional 0–1 confidence from admin or AI assist.';

-- ------------------------------------------------------------------
-- 6) payments — Checkout session id (additive)
-- ------------------------------------------------------------------
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text;

CREATE INDEX IF NOT EXISTS idx_payments_stripe_checkout_session
  ON public.payments (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;
