-- =============================================
-- AUTO-CREATE LAWYER PROFILE ON SIGNUP
-- =============================================
-- This trigger automatically creates a lawyer_profiles record
-- when a lawyer profile is created in the profiles table

CREATE OR REPLACE FUNCTION public.handle_new_lawyer_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only create lawyer_profiles if user_type is 'lawyer'
  IF NEW.user_type = 'lawyer' THEN
    INSERT INTO public.lawyer_profiles (id)
    VALUES (NEW.id)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_profile_created_lawyer ON public.profiles;

-- Create trigger that fires after insert on profiles
CREATE TRIGGER on_profile_created_lawyer
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_lawyer_profile();

