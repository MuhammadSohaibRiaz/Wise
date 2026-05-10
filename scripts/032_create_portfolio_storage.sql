-- =============================================
-- STORAGE BUCKETS FOR PORTFOLIO & VERIFICATION
-- =============================================

-- 1. Create 'case-studies' bucket for portfolio images
INSERT INTO storage.buckets (id, name, public)
VALUES ('case-studies', 'case-studies', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Create 'verifications' bucket for license documents
-- This is set to public for this FYP version to allow easy admin preview
INSERT INTO storage.buckets (id, name, public)
VALUES ('verifications', 'verifications', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Add license_file_url to lawyer_profiles
ALTER TABLE public.lawyer_profiles 
ADD COLUMN IF NOT EXISTS license_file_url TEXT;

-- 4. Storage Policies for 'case-studies'
DROP POLICY IF EXISTS "Anyone can view case study images" ON storage.objects;
CREATE POLICY "Anyone can view case study images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'case-studies');

DROP POLICY IF EXISTS "Lawyers can upload case study images" ON storage.objects;
CREATE POLICY "Lawyers can upload case study images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'case-studies');

-- 5. Storage Policies for 'verifications'
DROP POLICY IF EXISTS "Admins can view verification docs" ON storage.objects;
CREATE POLICY "Admins can view verification docs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'verifications');

DROP POLICY IF EXISTS "Lawyers can upload verification docs" ON storage.objects;
CREATE POLICY "Lawyers can upload verification docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'verifications');
