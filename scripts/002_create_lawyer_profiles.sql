-- Create lawyer-specific profile information
create table if not exists public.lawyer_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  specializations text[] default array[]::text[],
  hourly_rate decimal(10, 2),
  success_rate decimal(5, 2),
  total_cases integer default 0,
  total_earnings decimal(12, 2) default 0,
  average_rating decimal(3, 2) default 0,
  active_clients integer default 0,
  verified boolean default false,
  verified_at timestamp with time zone,
  bio_extended text,
  years_of_experience integer,
  bar_license_number text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.lawyer_profiles enable row level security;

-- RLS Policies for lawyer_profiles
create policy "lawyer_profiles_select_own"
  on public.lawyer_profiles for select
  using (auth.uid() = id);

create policy "lawyer_profiles_update_own"
  on public.lawyer_profiles for update
  using (auth.uid() = id);

create policy "lawyer_profiles_select_public"
  on public.lawyer_profiles for select
  using (true);
