-- =============================================================================
-- KYI private tenant CRM (write-up private layer) — additive to KYI 1.0
-- Run in Supabase SQL Editor after ecosystem migration. Idempotent.
--
-- Private only (never shared globally):
--   tasks, documents/NDAs, activity/comms, valuations, internal rating, assignee
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Columns on kyi_investors
-- -----------------------------------------------------------------------------
alter table public.kyi_investors
  add column if not exists internal_rating smallint
    check (internal_rating is null or (internal_rating >= 1 and internal_rating <= 5)),
  add column if not exists assigned_team_member uuid
    references auth.users(id) on delete set null;

create index if not exists kyi_investors_assigned_team_member_idx
  on public.kyi_investors (organization_id, assigned_team_member)
  where assigned_team_member is not null;

-- -----------------------------------------------------------------------------
-- 2. Follow-up tasks
-- -----------------------------------------------------------------------------
create table if not exists public.kyi_investor_tasks (
  id                bigserial primary key,
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  investor_id       bigint not null references public.kyi_investors(id) on delete cascade,
  company_id        bigint references public.kyi_companies(id) on delete set null,
  title             text not null,
  description       text,
  due_at            timestamptz,
  status            text not null default 'open'
                    check (status in ('open', 'done', 'cancelled')),
  assigned_to       uuid references auth.users(id) on delete set null,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists kyi_investor_tasks_investor_idx
  on public.kyi_investor_tasks (investor_id, status);
create index if not exists kyi_investor_tasks_org_idx
  on public.kyi_investor_tasks (organization_id, due_at);

alter table public.kyi_investor_tasks enable row level security;

drop policy if exists "kyi_investor_tasks_org" on public.kyi_investor_tasks;
create policy "kyi_investor_tasks_org" on public.kyi_investor_tasks
  for all to authenticated
  using (organization_id = public.get_user_organization_id())
  with check (organization_id = public.get_user_organization_id());

-- -----------------------------------------------------------------------------
-- 3. Documents / NDAs (metadata + URL; file bytes via Storage later)
-- -----------------------------------------------------------------------------
create table if not exists public.kyi_investor_documents (
  id                bigserial primary key,
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  investor_id       bigint not null references public.kyi_investors(id) on delete cascade,
  company_id        bigint references public.kyi_companies(id) on delete set null,
  title             text not null,
  document_url      text,
  is_nda            boolean not null default false,
  notes             text,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists kyi_investor_documents_investor_idx
  on public.kyi_investor_documents (investor_id);

alter table public.kyi_investor_documents enable row level security;

drop policy if exists "kyi_investor_documents_org" on public.kyi_investor_documents;
create policy "kyi_investor_documents_org" on public.kyi_investor_documents
  for all to authenticated
  using (organization_id = public.get_user_organization_id())
  with check (organization_id = public.get_user_organization_id());

-- -----------------------------------------------------------------------------
-- 4. Activity / communication / meeting history
-- -----------------------------------------------------------------------------
create table if not exists public.kyi_investor_activity (
  id                bigserial primary key,
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  investor_id       bigint not null references public.kyi_investors(id) on delete cascade,
  company_id        bigint references public.kyi_companies(id) on delete set null,
  activity_type     text not null
                    check (activity_type in (
                      'note', 'meeting', 'email', 'call', 'intro', 'other'
                    )),
  summary           text not null,
  occurred_at       timestamptz not null default now(),
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now()
);

create index if not exists kyi_investor_activity_investor_idx
  on public.kyi_investor_activity (investor_id, occurred_at desc);

alter table public.kyi_investor_activity enable row level security;

drop policy if exists "kyi_investor_activity_org" on public.kyi_investor_activity;
create policy "kyi_investor_activity_org" on public.kyi_investor_activity
  for all to authenticated
  using (organization_id = public.get_user_organization_id())
  with check (organization_id = public.get_user_organization_id());

-- -----------------------------------------------------------------------------
-- 5. Valuation / deal-term discussions
-- -----------------------------------------------------------------------------
create table if not exists public.kyi_investor_valuations (
  id                bigserial primary key,
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  investor_id       bigint not null references public.kyi_investors(id) on delete cascade,
  company_id        bigint references public.kyi_companies(id) on delete set null,
  label             text not null default 'Discussion',
  pre_money         numeric,
  post_money        numeric,
  amount_discussed  numeric,
  currency          text not null default 'USD',
  notes             text,
  discussed_at      timestamptz not null default now(),
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists kyi_investor_valuations_investor_idx
  on public.kyi_investor_valuations (investor_id, discussed_at desc);

alter table public.kyi_investor_valuations enable row level security;

drop policy if exists "kyi_investor_valuations_org" on public.kyi_investor_valuations;
create policy "kyi_investor_valuations_org" on public.kyi_investor_valuations
  for all to authenticated
  using (organization_id = public.get_user_organization_id())
  with check (organization_id = public.get_user_organization_id());
