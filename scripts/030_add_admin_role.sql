-- =============================================
-- ADD ADMIN ROLE TO PROFILES
-- =============================================
-- This allows for administrative access to verify lawyers
-- and manage the platform.

-- Update profiles user_type check constraint
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_user_type_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_user_type_check 
CHECK (user_type IN ('client', 'lawyer', 'admin'));

-- Update policy to allow admins to see all profiles
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
CREATE POLICY "profiles_select_admin" 
  ON public.profiles FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- Update lawyer_profiles policy to allow admins to update (verify)
DROP POLICY IF EXISTS "lawyer_profiles_update_admin" ON public.lawyer_profiles;
CREATE POLICY "lawyer_profiles_update_admin" 
  ON public.lawyer_profiles FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );
