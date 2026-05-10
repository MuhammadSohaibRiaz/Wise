-- =============================================
-- CORE UTILITIES & DISPUTES SYSTEM (FINAL)
-- =============================================

-- 1. Create handle_updated_at function (Utility)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create is_admin function (Security)
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND user_type = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create case_disputes table
CREATE TABLE IF NOT EXISTS public.case_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  raised_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'closed')),
  admin_notes TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Enable RLS
ALTER TABLE public.case_disputes ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DROP POLICY IF EXISTS "Users can view own case disputes" ON public.case_disputes;
CREATE POLICY "Users can view own case disputes"
  ON public.case_disputes FOR SELECT
  TO authenticated
  USING (
    auth.uid() = raised_by OR 
    auth.uid() IN (SELECT client_id FROM public.cases WHERE id = case_id) OR
    auth.uid() IN (SELECT lawyer_id FROM public.cases WHERE id = case_id) OR
    public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Clients can insert disputes" ON public.case_disputes;
CREATE POLICY "Clients can insert disputes"
  ON public.case_disputes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = raised_by);

DROP POLICY IF EXISTS "Admins have full access to disputes" ON public.case_disputes;
CREATE POLICY "Admins have full access to disputes"
  ON public.case_disputes FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- 6. Update Trigger
DROP TRIGGER IF EXISTS handle_disputes_updated_at ON public.case_disputes;
CREATE TRIGGER handle_disputes_updated_at 
  BEFORE UPDATE ON public.case_disputes
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
