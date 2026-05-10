-- Create appointments table
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  lawyer_id uuid not null references public.profiles(id) on delete cascade,
  scheduled_at timestamp with time zone not null,
  duration_minutes integer default 60,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled', 'rescheduled')),
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.appointments enable row level security;

-- RLS Policies for appointments
create policy "appointments_select_own"
  on public.appointments for select
  using (auth.uid() = client_id or auth.uid() = lawyer_id);

create policy "appointments_insert_own"
  on public.appointments for insert
  with check (auth.uid() = client_id);

create policy "appointments_update_own"
  on public.appointments for update
  using (auth.uid() = client_id or auth.uid() = lawyer_id);
