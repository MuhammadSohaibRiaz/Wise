-- Create documents table for case documents and analysis
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  file_type text,
  file_size integer,
  document_type text,
  status text default 'pending' check (status in ('pending', 'analyzing', 'completed', 'failed')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.documents enable row level security;

-- RLS Policies for documents
create policy "documents_select_own"
  on public.documents for select
  using (auth.uid() = uploaded_by or auth.uid() in (
    select client_id from public.cases where id = case_id
    union
    select lawyer_id from public.cases where id = case_id
  ));

create policy "documents_insert_own"
  on public.documents for insert
  with check (auth.uid() = uploaded_by);
