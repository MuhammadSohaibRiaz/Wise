-- Create case_studies table for lawyer portfolios
create table if not exists public.case_studies (
  id uuid primary key default gen_random_uuid(),
  lawyer_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  category text not null,
  outcome text not null,
  description text,
  image_url text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.case_studies enable row level security;

-- RLS Policies
create policy "Anyone can view published case studies"
  on public.case_studies for select
  using (true);

create policy "Lawyers can manage their own case studies"
  on public.case_studies for all
  using (auth.uid() = lawyer_id);
