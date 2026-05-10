-- =============================================
-- Case counterpart profile visibility (lawyer ↔ client)
-- =============================================
-- Lawyers could not read client profiles (only own row + public lawyer rows).
-- Joins like cases → client returned NULL for lawyers, showing "No client assigned"
-- even when client_id was set. Same for appointments.client embed.
--
-- Run once after reviewing policies (idempotent safe definitions).

-- Lawyer may read a client profile if that client has any case with this lawyer.
CREATE POLICY "profiles_select_client_on_my_cases"
  ON public.profiles FOR SELECT
  USING (
    user_type = 'client'
    AND EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.client_id = profiles.id
        AND c.lawyer_id = auth.uid()
    )
  );

-- Client may read another user's profile if they share an appointment (booking flow embeds).
CREATE POLICY "profiles_select_counterparty_via_appointment"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE (a.client_id = auth.uid() AND a.lawyer_id = profiles.id)
         OR (a.lawyer_id = auth.uid() AND a.client_id = profiles.id)
    )
  );

COMMENT ON POLICY "profiles_select_client_on_my_cases" ON public.profiles IS
  'Lawyers see client name/avatar on cases they handle.';
COMMENT ON POLICY "profiles_select_counterparty_via_appointment" ON public.profiles IS
  'Either party can load the other profile when an appointment exists between them.';

