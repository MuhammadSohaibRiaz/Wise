-- 063 — Admin read access + Realtime for cancellation dashboard
-- Run in Supabase SQL editor after 060 (appointments realtime).
-- Safe to re-run.

DROP POLICY IF EXISTS "appointments_select_admin" ON public.appointments;
CREATE POLICY "appointments_select_admin"
  ON public.appointments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

DROP POLICY IF EXISTS "payments_select_admin" ON public.payments;
CREATE POLICY "payments_select_admin"
  ON public.payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- Realtime publication (ignore "already member of publication" if re-run)
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
