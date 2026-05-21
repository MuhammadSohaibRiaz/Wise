-- Application-level email verification (independent of Supabase auto-confirm settings)
alter table public.profiles
  add column if not exists email_verified_at timestamptz;

comment on column public.profiles.email_verified_at is
  'Set when the user completes the verification link sent via Resend; required for sign-in.';

-- Grandfather only accounts created before this enforcement shipped (avoids auto-confirm bypass)
update public.profiles
set email_verified_at = coalesce(email_verified_at, created_at)
where email_verified_at is null
  and created_at < timestamptz '2026-05-21 00:00:00+00';
