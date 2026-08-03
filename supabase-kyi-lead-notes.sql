-- KYI: per-lead notes scoped to an investor (Orbit / suggested leads).
-- Run after supabase-kyi-schema.sql and supabase-user-isolation-migration.sql.
-- RLS: only the owner of the investor row (kyi_investors.user_id = auth.uid()) can read/write.

create table if not exists public.kyi_lead_notes (
  id           serial primary key,
  lead_id      integer not null references public.kyi_investor_leads (id) on delete cascade,
  investor_id  integer not null references public.kyi_investors (id) on delete cascade,
  body         text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (lead_id, investor_id)
);

create index if not exists kyi_lead_notes_investor_lead_idx
  on public.kyi_lead_notes (investor_id, lead_id);

alter table public.kyi_lead_notes enable row level security;

drop policy if exists "kyi_lead_notes_investor_owner" on public.kyi_lead_notes;

create policy "kyi_lead_notes_investor_owner"
  on public.kyi_lead_notes
  for all
  using (
    exists (
      select 1
      from public.kyi_investors i
      where i.id = kyi_lead_notes.investor_id
        and i.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.kyi_investors i
      where i.id = kyi_lead_notes.investor_id
        and i.user_id = auth.uid()
    )
  );

-- If legacy "Allow all" style exists from older installs, drop it for this table only.
drop policy if exists "Allow all on kyi_lead_notes" on public.kyi_lead_notes;
