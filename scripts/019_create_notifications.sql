-- =============================================
-- Create notifications table for in-app alerts
-- Run this after 016 & 018 migrations
-- =============================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('message', 'appointment_request', 'appointment_update', 'case_update')),
  title text not null,
  description text,
  data jsonb default '{}'::jsonb,
  is_read boolean default false,
  created_at timestamp with time zone default now()
);

create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_created_at on public.notifications(created_at desc);

alter table public.notifications enable row level security;

-- Allow recipients to read their own notifications
create policy "notifications_select_own"
  on public.notifications for select
  using (auth.uid() = user_id);

-- Allow recipients to update/delete their own notifications
create policy "notifications_update_own"
  on public.notifications for update
  using (auth.uid() = user_id);

create policy "notifications_delete_own"
  on public.notifications for delete
  using (auth.uid() = user_id);

-- Allow authenticated users to create notifications for other users
create policy "notifications_insert_creator"
  on public.notifications for insert
  with check (auth.uid() = created_by);


