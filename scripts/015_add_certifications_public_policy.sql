-- =============================================
-- ADD PUBLIC RLS POLICY FOR CERTIFICATIONS
-- =============================================
-- Allow public read access to certifications for lawyer profiles
-- This is needed for the public lawyer profile pages

-- Drop existing policy if it exists (in case of re-run)
DROP POLICY IF EXISTS "certifications_select_public" ON certifications;

-- Create public read policy for certifications
CREATE POLICY "certifications_select_public"
  ON certifications FOR SELECT
  USING (true);

