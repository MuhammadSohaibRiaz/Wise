-- Create document analysis results table
create table if not exists public.document_analysis (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  summary text,
  key_terms text[],
  risk_assessment text,
  recommendations text,
  extracted_text text,
  analysis_status text default 'pending' check (analysis_status in ('pending', 'processing', 'completed', 'failed')),
  error_message text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.document_analysis enable row level security;

-- RLS Policies for document_analysis
create policy "document_analysis_select_own"
  on public.document_analysis for select
  using (auth.uid() in (
    select uploaded_by from public.documents where id = document_id
    union
    select client_id from public.cases where id = (
      select case_id from public.documents where id = document_id
    )
    union
    select lawyer_id from public.cases where id = (
      select case_id from public.documents where id = document_id
    )
  ));
