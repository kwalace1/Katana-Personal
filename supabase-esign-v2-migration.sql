-- =============================================================================
-- Katana E-Sign v2 — linking, templates, reminders
-- Run after supabase-esign-schema.sql
-- (Webhook tables intentionally omitted — not used in the product UI.)
-- =============================================================================

-- Document links + reminder tracking
alter table public.esign_documents
  add column if not exists client_id uuid,
  add column if not exists project_id uuid,
  add column if not exists template_id uuid,
  add column if not exists last_reminded_at timestamptz,
  add column if not exists reminder_every_days int;

create index if not exists esign_documents_client_idx
  on public.esign_documents(organization_id, client_id);
create index if not exists esign_documents_project_idx
  on public.esign_documents(organization_id, project_id);

-- Reusable templates (field layouts + default metadata)
create table if not exists public.esign_templates (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  default_title text,
  field_blueprint jsonb not null default '[]'::jsonb,
  default_signer_count int not null default 1,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists esign_templates_org_idx on public.esign_templates(organization_id);

alter table public.esign_templates enable row level security;

do $$
begin
  execute 'drop policy if exists "Esign templates: org select" on public.esign_templates';
  execute 'create policy "Esign templates: org select" on public.esign_templates for select using (organization_id = public.esign_user_org_id())';
  execute 'drop policy if exists "Esign templates: org insert" on public.esign_templates';
  execute 'create policy "Esign templates: org insert" on public.esign_templates for insert with check (organization_id = public.esign_user_org_id())';
  execute 'drop policy if exists "Esign templates: org update" on public.esign_templates';
  execute 'create policy "Esign templates: org update" on public.esign_templates for update using (organization_id = public.esign_user_org_id())';
  execute 'drop policy if exists "Esign templates: org delete" on public.esign_templates';
  execute 'create policy "Esign templates: org delete" on public.esign_templates for delete using (organization_id = public.esign_user_org_id())';
end $$;

-- Optional FK from documents → templates (after table exists)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'esign_documents_template_id_fkey'
  ) then
    alter table public.esign_documents
      add constraint esign_documents_template_id_fkey
      foreign key (template_id) references public.esign_templates(id) on delete set null;
  end if;
end $$;
