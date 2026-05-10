-- Create payments table
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  lawyer_id uuid not null references public.profiles(id) on delete cascade,
  amount decimal(12, 2) not null,
  currency text default 'USD',
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed', 'refunded')),
  stripe_payment_id text,
  payment_method text,
  description text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.payments enable row level security;

-- RLS Policies for payments
create policy "payments_select_own"
  on public.payments for select
  using (auth.uid() = client_id or auth.uid() = lawyer_id);

create policy "payments_insert_own"
  on public.payments for insert
  with check (auth.uid() = client_id);
