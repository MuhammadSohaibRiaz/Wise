-- =============================================
-- FIX PROFILES RLS RECURSION
-- =============================================
-- This script fixes the "infinite recursion detected in policy" error
-- by using a SECURITY DEFINER function to check the user's role.

-- 1. Create a helper function to check if the user is an admin
-- SECURITY DEFINER allows it to bypass RLS for this specific check
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND user_type = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop the problematic policies
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "lawyer_profiles_update_admin" ON public.lawyer_profiles;
DROP POLICY IF EXISTS "lawyer_profiles_select_admin" ON public.lawyer_profiles;

-- 3. Create the new, safe policies using the function
CREATE POLICY "profiles_select_admin" 
  ON public.profiles FOR SELECT 
  USING (public.is_admin());

CREATE POLICY "lawyer_profiles_update_admin" 
  ON public.lawyer_profiles FOR UPDATE 
  USING (public.is_admin());

CREATE POLICY "lawyer_profiles_select_admin" 
  ON public.lawyer_profiles FOR SELECT 
  USING (public.is_admin());

-- Add comment for documentation
COMMENT ON FUNCTION public.is_admin() IS 'Checks if the current authenticated user has the admin role. Used in RLS policies to avoid recursion.';
