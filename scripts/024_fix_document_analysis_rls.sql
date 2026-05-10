-- =============================================
-- FIX RLS POLICIES FOR DOCUMENT_ANALYSIS
-- =============================================
-- This script adds missing INSERT and UPDATE policies for document_analysis
-- Run this in Supabase SQL Editor

-- 1. Policy to allow users to insert analysis for their own documents
DROP POLICY IF EXISTS "document_analysis_insert_own" ON public.document_analysis;
CREATE POLICY "document_analysis_insert_own"
  ON public.document_analysis FOR INSERT
  WITH CHECK (auth.uid() IN (
    SELECT uploaded_by FROM public.documents WHERE id = document_id
  ));

-- 2. Policy to allow users to update analysis for their own documents
DROP POLICY IF EXISTS "document_analysis_update_own" ON public.document_analysis;
CREATE POLICY "document_analysis_update_own"
  ON public.document_analysis FOR UPDATE
  USING (auth.uid() IN (
    SELECT uploaded_by FROM public.documents WHERE id = document_id
  ));

-- 3. Ensure the select policy covers all relevant parties (Already exists, but re-verifying)
DROP POLICY IF EXISTS "document_analysis_select_own" ON public.document_analysis;
CREATE POLICY "document_analysis_select_own"
  ON public.document_analysis FOR SELECT
  USING (auth.uid() IN (
    SELECT uploaded_by FROM public.documents WHERE id = document_id
    UNION
    SELECT client_id FROM public.cases WHERE id = (
      SELECT case_id FROM public.documents WHERE id = document_id
    )
    UNION
    SELECT lawyer_id FROM public.cases WHERE id = (
      SELECT case_id FROM public.documents WHERE id = document_id
    )
  ));
