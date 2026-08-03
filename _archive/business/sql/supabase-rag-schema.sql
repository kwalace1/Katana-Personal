-- RAG (Retrieval-Augmented Generation) schema for Katana Sync (KSync)
-- Run this in Supabase SQL Editor
--
-- SECURITY: This table stores SYSTEM-LEVEL knowledge ONLY (code docs, schemas,
-- feature descriptions). It must NEVER contain tenant/organization-specific data
-- such as employee records, customer data, project details, or any data that
-- belongs to a specific organization. All content here is visible to every
-- authenticated user across all organizations.

-- Enable pgvector extension
create extension if not exists vector with schema extensions;

-- Document chunks for RAG retrieval (SYSTEM KNOWLEDGE ONLY)
create table if not exists rag_documents (
  id bigint primary key generated always as identity,
  content text not null,
  metadata jsonb not null default '{}',
  source_path text not null,
  source_type text not null check (source_type in ('code', 'doc', 'schema', 'config')),
  chunk_index int not null default 0,
  embedding vector(1024),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- IMPORTANT: There is intentionally NO organization_id column on this table.
-- This table is for shared system knowledge only. Tenant-specific data must
-- NEVER be stored here. If org-scoped RAG is needed in the future, create a
-- SEPARATE table (e.g., rag_org_documents) with organization_id and strict
-- RLS policies scoped to auth.jwt()->>'organization_id'.

create index if not exists rag_documents_embedding_idx
  on rag_documents
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 50);

create index if not exists rag_documents_source_type_idx
  on rag_documents (source_type);

create unique index if not exists rag_documents_source_chunk_idx
  on rag_documents (source_path, chunk_index);

-- Similarity search function
create or replace function match_rag_documents(
  query_embedding vector(1024),
  match_threshold float default 0.3,
  match_count int default 8
)
returns table (
  id bigint,
  content text,
  metadata jsonb,
  source_path text,
  source_type text,
  similarity float
)
language sql stable
as $$
  select
    rd.id,
    rd.content,
    rd.metadata,
    rd.source_path,
    rd.source_type,
    1 - (rd.embedding <=> query_embedding) as similarity
  from rag_documents rd
  where 1 - (rd.embedding <=> query_embedding) > match_threshold
  order by rd.embedding <=> query_embedding
  limit match_count;
$$;

-- RLS: authenticated users can read (system knowledge is shared)
alter table rag_documents enable row level security;

create policy "Authenticated users can read system knowledge"
  on rag_documents for select
  to authenticated
  using (true);

-- Anon users CANNOT read — must be signed in
-- (no policy for anon role = denied by default)

-- Only service role can insert/update/delete (indexing script)
create policy "Service role manages rag_documents"
  on rag_documents for all
  to service_role
  using (true)
  with check (true);
