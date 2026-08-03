-- =============================================================================
-- Katana E-Sign — documents, signers, signature fields, storage
-- Run in Supabase Dashboard → SQL Editor
-- =============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Documents
-- -----------------------------------------------------------------------------
create table if not exists public.esign_documents (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'draft' check (
    status in ('draft', 'pending', 'partially_signed', 'signed', 'cancelled', 'expired')
  ),
  file_path text not null,
  file_name text not null,
  mime_type text not null default 'application/pdf',
  signed_file_path text,
  expires_at timestamptz,
  client_id uuid,
  project_id uuid,
  template_id uuid,
  last_reminded_at timestamptz,
  reminder_every_days int,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists esign_documents_org_idx on public.esign_documents(organization_id);
create index if not exists esign_documents_status_idx on public.esign_documents(organization_id, status);
create index if not exists esign_documents_created_idx on public.esign_documents(organization_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Signers
-- -----------------------------------------------------------------------------
create table if not exists public.esign_signers (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.esign_documents(id) on delete cascade,
  name text not null,
  email text,
  signing_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  signing_order int not null default 1,
  signed_at timestamptz,
  signature_text text,
  signature_image_path text,
  ip_address text,
  user_agent text,
  token_expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists esign_signers_doc_idx on public.esign_signers(document_id);
create index if not exists esign_signers_org_idx on public.esign_signers(organization_id);
create index if not exists esign_signers_token_idx on public.esign_signers(signing_token);

-- -----------------------------------------------------------------------------
-- Fields (signature / name / date boxes placed on the PDF)
-- Coordinates are percentages of page width/height (0–100).
-- -----------------------------------------------------------------------------
create table if not exists public.esign_fields (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.esign_documents(id) on delete cascade,
  signer_id uuid references public.esign_signers(id) on delete cascade,
  field_type text not null check (field_type in ('signature', 'name', 'date')),
  page_index int not null default 0 check (page_index >= 0),
  x_pct double precision not null default 10,
  y_pct double precision not null default 80,
  width_pct double precision not null default 30,
  height_pct double precision not null default 8,
  created_at timestamptz not null default now()
);

create index if not exists esign_fields_doc_idx on public.esign_fields(document_id);
create index if not exists esign_fields_signer_idx on public.esign_fields(signer_id);

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function public.esign_user_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.user_profiles where id = auth.uid()
$$;

create or replace function public.esign_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists esign_documents_updated_at on public.esign_documents;
create trigger esign_documents_updated_at
  before update on public.esign_documents
  for each row execute function public.esign_touch_updated_at();

create or replace function public.esign_recompute_document_status(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int;
  v_signed int;
  v_expires timestamptz;
  v_status text;
begin
  select expires_at into v_expires from public.esign_documents where id = p_document_id;
  select count(*), count(*) filter (where signed_at is not null)
    into v_total, v_signed
  from public.esign_signers
  where document_id = p_document_id;

  if v_expires is not null and v_expires < now() and (v_total = 0 or v_signed < v_total) then
    v_status := 'expired';
  elsif v_total > 0 and v_signed = v_total then
    v_status := 'signed';
  elsif v_signed > 0 then
    v_status := 'partially_signed';
  else
    select case when status = 'draft' then 'draft' else 'pending' end
      into v_status
    from public.esign_documents where id = p_document_id;
  end if;

  update public.esign_documents
    set status = v_status, updated_at = now()
  where id = p_document_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.esign_documents enable row level security;
alter table public.esign_signers enable row level security;
alter table public.esign_fields enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['esign_documents', 'esign_signers', 'esign_fields']
  loop
    execute format('drop policy if exists "Esign: org select" on public.%I', t);
    execute format(
      'create policy "Esign: org select" on public.%I for select using (organization_id = public.esign_user_org_id())',
      t
    );
    execute format('drop policy if exists "Esign: org insert" on public.%I', t);
    execute format(
      'create policy "Esign: org insert" on public.%I for insert with check (organization_id = public.esign_user_org_id())',
      t
    );
    execute format('drop policy if exists "Esign: org update" on public.%I', t);
    execute format(
      'create policy "Esign: org update" on public.%I for update using (organization_id = public.esign_user_org_id())',
      t
    );
    execute format('drop policy if exists "Esign: org delete" on public.%I', t);
    execute format(
      'create policy "Esign: org delete" on public.%I for delete using (organization_id = public.esign_user_org_id())',
      t
    );
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Storage bucket
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'esign-files',
  'esign-files',
  false,
  26214400,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

drop policy if exists "esign_files_org_insert" on storage.objects;
create policy "esign_files_org_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'esign-files'
    and (storage.foldername(name))[1] = public.esign_user_org_id()::text
  );

drop policy if exists "esign_files_org_select" on storage.objects;
create policy "esign_files_org_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'esign-files'
    and (storage.foldername(name))[1] = public.esign_user_org_id()::text
  );

drop policy if exists "esign_files_org_update" on storage.objects;
create policy "esign_files_org_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'esign-files'
    and (storage.foldername(name))[1] = public.esign_user_org_id()::text
  );

drop policy if exists "esign_files_org_delete" on storage.objects;
create policy "esign_files_org_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'esign-files'
    and (storage.foldername(name))[1] = public.esign_user_org_id()::text
  );
