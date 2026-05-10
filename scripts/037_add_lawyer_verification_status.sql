-- =============================================
-- Add explicit lawyer verification workflow states
-- =============================================
-- Run after 036

alter table public.lawyer_profiles
add column if not exists verification_status text;

update public.lawyer_profiles
set verification_status = case
  when verified = true then 'approved'
  else 'pending'
end
where verification_status is null;

alter table public.lawyer_profiles
alter column verification_status set default 'pending';

alter table public.lawyer_profiles
drop constraint if exists lawyer_profiles_verification_status_check;

alter table public.lawyer_profiles
add constraint lawyer_profiles_verification_status_check
check (verification_status in ('pending', 'approved', 'rejected'));

comment on column public.lawyer_profiles.verification_status is
  'Admin verification state for lawyer onboarding: pending, approved, or rejected.';
