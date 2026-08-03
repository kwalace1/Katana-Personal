-- ============================================================================
-- Agent answer audits  (Agent Office "observer" quality log)
-- Purpose: every delivered agent answer is logged here with (a) cheap inline
--   deterministic flags computed on the client and (b) an async LLM-observer
--   verdict written by the agent-observer edge function. Powers the owner/admin
--   Quality dashboard at /agents/quality and feeds new eval cases.
-- Run in the Supabase SQL editor or via MCP apply_migration. Idempotent.
-- ============================================================================

create extension if not exists "uuid-ossp";

create table if not exists public.agent_answer_audits (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  agent_id text not null,
  agent_name text,
  session_id text,
  question text,
  answer text,
  used_sql boolean not null default false,
  delegated_to text[] not null default '{}',
  latency_ms integer,
  -- (a) inline deterministic flags (leaked_json, empty, error_marker, refusal, sanitizer_fired)
  flags jsonb not null default '{}'::jsonb,
  det_flagged boolean not null default false,
  -- (b) async LLM-observer verdict
  observer_status text not null default 'pending'
    check (observer_status in ('pending','ok','flagged','error','skipped')),
  observer_score integer,
  observer_verdict text,   -- grounded | ungrounded | uncertain
  observer_reasons text,
  observer_model text,
  created_at timestamptz not null default now()
);

create index if not exists agent_answer_audits_org_idx
  on public.agent_answer_audits (organization_id, created_at desc);
create index if not exists agent_answer_audits_agent_idx
  on public.agent_answer_audits (organization_id, agent_id, created_at desc);
create index if not exists agent_answer_audits_flagged_idx
  on public.agent_answer_audits (organization_id, created_at desc)
  where det_flagged or observer_status = 'flagged';

alter table public.agent_answer_audits enable row level security;

-- Read is restricted to org owners/admins: audits contain other users' agent
-- Q&A, so this is a management-only view (the UI route is also admin-gated).
drop policy if exists "org_admin_read_agent_answer_audits" on public.agent_answer_audits;
create policy "org_admin_read_agent_answer_audits" on public.agent_answer_audits
  for select
  using (
    organization_id = public.get_user_organization_id()
    and exists (
      select 1 from public.user_profiles p
      where p.id = auth.uid() and p.role in ('owner', 'admin')
    )
  );

-- Writes come only from the agent-observer edge function using the service role,
-- which bypasses RLS. No client insert/update/delete policy is granted on
-- purpose, so a browser can never forge or tamper with audit rows.

comment on table public.agent_answer_audits is
  'Agent Office observer log: one row per delivered agent answer with inline deterministic flags and an async LLM-observer verdict. Written by the agent-observer edge function (service role); read by org owners/admins for the Quality dashboard.';
