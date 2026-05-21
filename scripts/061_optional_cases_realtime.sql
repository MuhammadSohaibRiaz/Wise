-- Enable Supabase Realtime for case detail stepper sync (cases + timeline).
-- Safe to re-run: ignore "already member of publication" if present.

ALTER PUBLICATION supabase_realtime ADD TABLE public.cases;
ALTER PUBLICATION supabase_realtime ADD TABLE public.case_timeline_events;
