-- =============================================================================
-- Katana Switch integration — OAuth clients, ingest jobs, entity mappings
-- Run in Supabase SQL Editor before using /switch/* ingest APIs.
-- Service role bypasses RLS; tables are server-only (no client policies).
-- =============================================================================

create extension if not exists "uuid-ossp";

-- -----------------------------------------------------------------------------
-- switch_oauth_clients — machine credentials for Switch → Katana
-- -----------------------------------------------------------------------------
create table if not exists public.switch_oauth_clients (
  id uuid primary key default uuid_generate_v4(),
  client_id text not null unique,
  client_secret_hash text not null,
  name text not null default 'Switch',
  organization_id uuid not null references public.organizations(id) on delete cascade,
  acting_user_id uuid references auth.users(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists switch_oauth_clients_org_idx
  on public.switch_oauth_clients(organization_id);

-- -----------------------------------------------------------------------------
-- switch_oauth_tokens — opaque bearer tokens (client credentials flow)
-- -----------------------------------------------------------------------------
create table if not exists public.switch_oauth_tokens (
  id uuid primary key default uuid_generate_v4(),
  client_ref uuid not null references public.switch_oauth_clients(id) on delete cascade,
  access_token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists switch_oauth_tokens_expires_idx
  on public.switch_oauth_tokens(expires_at);

-- -----------------------------------------------------------------------------
-- switch_ingest_jobs — batch tracking
-- -----------------------------------------------------------------------------
create table if not exists public.switch_ingest_jobs (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_ref uuid references public.switch_oauth_clients(id) on delete set null,
  job_type text not null check (job_type in ('files', 'records', 'mixed')),
  status text not null default 'processing'
    check (status in ('processing', 'completed', 'partial', 'failed')),
  source_system text,
  accepted_count integer not null default 0,
  failed_count integer not null default 0,
  error_summary text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists switch_ingest_jobs_org_idx
  on public.switch_ingest_jobs(organization_id, created_at desc);

-- -----------------------------------------------------------------------------
-- switch_ingest_files — file ingest audit + storage refs
-- -----------------------------------------------------------------------------
create table if not exists public.switch_ingest_files (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid references public.switch_ingest_jobs(id) on delete set null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  external_id text not null,
  file_name text not null,
  mime_type text,
  module text not null default 'switch-ingest',
  bucket text not null default 'switch-ingest',
  storage_path text,
  public_url text,
  source_type text not null check (source_type in ('signed_url', 'public_url', 'webhook')),
  source_url text,
  status text not null default 'pending'
    check (status in ('pending', 'ingested', 'failed')),
  error_code text,
  error_message text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (organization_id, external_id)
);

create index if not exists switch_ingest_files_job_idx
  on public.switch_ingest_files(job_id);

-- -----------------------------------------------------------------------------
-- switch_entity_mappings — external_id → Katana row (idempotent upserts)
-- -----------------------------------------------------------------------------
create table if not exists public.switch_entity_mappings (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_type text not null,
  external_id text not null,
  katana_id uuid not null,
  katana_table text not null,
  last_job_id uuid references public.switch_ingest_jobs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, entity_type, external_id)
);

create index if not exists switch_entity_mappings_katana_idx
  on public.switch_entity_mappings(katana_table, katana_id);

-- RLS: deny all for anon/authenticated; service role only
alter table public.switch_oauth_clients enable row level security;
alter table public.switch_oauth_tokens enable row level security;
alter table public.switch_ingest_jobs enable row level security;
alter table public.switch_ingest_files enable row level security;
alter table public.switch_entity_mappings enable row level security;

-- No policies = only service_role can access (bypasses RLS)

-- Optional: seed a dev client (replace placeholders before running in prod)
-- INSERT INTO public.switch_oauth_clients (client_id, client_secret_hash, name, organization_id, acting_user_id)
-- VALUES (
--   'switch-dev',
--   encode(sha256('your-dev-secret'::bytea), 'hex'),
--   'Switch Dev',
--   '<ORG_UUID>',
--   '<ACTING_USER_UUID>'
-- );
