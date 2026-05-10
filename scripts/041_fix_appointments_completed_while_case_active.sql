-- Repair rows where an appointment was marked "completed" while the case is still active
-- and the consultation is still in the future (common legacy bug after payment).
-- Safe to run multiple times.

UPDATE public.appointments AS a
SET
  status = 'scheduled',
  updated_at = now()
FROM public.cases AS c
WHERE a.case_id = c.id
  AND a.status = 'completed'
  AND c.status NOT IN ('completed', 'closed')
  AND a.scheduled_at > now();
