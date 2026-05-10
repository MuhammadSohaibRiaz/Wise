-- Create reviews table
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  reviewee_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text,
  status text default 'pending' check (status in ('pending', 'published', 'rejected')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.reviews enable row level security;

-- RLS Policies for reviews
create policy "reviews_select_own"
  on public.reviews for select
  using (auth.uid() = reviewer_id or auth.uid() = reviewee_id or status = 'published');

create policy "reviews_insert_own"
  on public.reviews for insert
  with check (auth.uid() = reviewer_id);

create policy "reviews_update_own"
  on public.reviews for update
  using (auth.uid() = reviewer_id);
