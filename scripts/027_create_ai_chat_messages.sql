-- Create ai_chat_messages table to persist chatbot history
create table if not exists public.ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.ai_chat_messages enable row level security;

-- RLS Policies
create policy "Users can view their own AI chat messages"
  on public.ai_chat_messages for select
  using (auth.uid() = user_id);

create policy "Users can insert their own AI chat messages"
  on public.ai_chat_messages for insert
  with check (auth.uid() = user_id);

-- Index for faster retrieval
create index if not exists ai_chat_messages_user_id_idx on public.ai_chat_messages(user_id);
create index if not exists ai_chat_messages_created_at_idx on public.ai_chat_messages(created_at);
