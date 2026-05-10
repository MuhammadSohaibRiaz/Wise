-- =============================================
-- 046 — Scope AI chat history to cases (Phase 5)
-- =============================================
-- Run after 027_create_ai_chat_messages.sql

ALTER TABLE public.ai_chat_messages
  ADD COLUMN IF NOT EXISTS case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ai_chat_messages_user_case_created_idx
  ON public.ai_chat_messages(user_id, case_id, created_at);

COMMENT ON COLUMN public.ai_chat_messages.case_id IS
  'Optional case context for AI assistant message history.';
