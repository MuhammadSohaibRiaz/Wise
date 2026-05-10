-- Create profiles table for users (clients and lawyers)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  user_type text not null check (user_type in ('client', 'lawyer')),
  first_name text,
  last_name text,
  email text,
  phone text,
  avatar_url text,
  bio text,
  location text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.profiles enable row level security;

-- RLS Policies for profiles
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

create policy "profiles_delete_own"
  on public.profiles for delete
  using (auth.uid() = id);

-- Allow public read for lawyer profiles (for search/discovery)
create policy "profiles_select_lawyers_public"
  on public.profiles for select
  using (user_type = 'lawyer');
