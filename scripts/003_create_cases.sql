-- Create cases table
create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  lawyer_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'closed')),
  case_type text,
  budget_min decimal(10, 2),
  budget_max decimal(10, 2),
  hourly_rate decimal(10, 2),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.cases enable row level security;

-- RLS Policies for cases
create policy "cases_select_own"
  on public.cases for select
  using (auth.uid() = client_id or auth.uid() = lawyer_id);

create policy "cases_insert_own"
  on public.cases for insert
  with check (auth.uid() = client_id);

create policy "cases_update_own"
  on public.cases for update
  using (auth.uid() = client_id or auth.uid() = lawyer_id);

create policy "cases_delete_own"
  on public.cases for delete
  using (auth.uid() = client_id);
