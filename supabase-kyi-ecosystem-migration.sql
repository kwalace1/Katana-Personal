-- =============================================================================
-- KYI 2.0 ecosystem: shared global investor directory + private org associations
-- Run in Supabase SQL Editor (idempotent).
--
-- Global layer:  kyi_global_investors, kyi_investor_category_defs, junction
-- Private layer: existing kyi_investors (notes, pipeline, outreach) + FK link
-- Leads:         optional global_investor_id for promote/link from catalog
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Global investor directory (shared across all tenants)
-- -----------------------------------------------------------------------------
create table if not exists public.kyi_global_investors (
  id                bigserial primary key,
  entity_type       text not null default 'person'
                    check (entity_type in ('person', 'firm')),
  display_name      text not null,
  firm              text,
  title             text,
  location          text,
  industry          text,
  website           text,
  profile_url       text,
  linkedin_url      text,
  public_email      text,
  public_phone      text,
  investment_focus  text,
  public_history    text,
  firm_metadata     jsonb not null default '{}'::jsonb,
  geo_lat           double precision,
  geo_lng           double precision,
  -- Stable dedupe key: lower(trim(name)) || '|' || lower(trim(coalesce(firm,'')))
  dedupe_key        text not null,
  source            text not null default 'platform'
                    check (source in ('platform', 'tenant', 'enriched', 'lead_import')),
  created_by_org_id uuid references public.organizations(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint kyi_global_investors_dedupe_key_unique unique (dedupe_key)
);

create index if not exists kyi_global_investors_name_idx
  on public.kyi_global_investors (lower(display_name));
create index if not exists kyi_global_investors_firm_idx
  on public.kyi_global_investors (lower(coalesce(firm, '')));
create index if not exists kyi_global_investors_industry_idx
  on public.kyi_global_investors (lower(coalesce(industry, '')));

-- -----------------------------------------------------------------------------
-- 2. Platform category taxonomy (faceted)
-- -----------------------------------------------------------------------------
create table if not exists public.kyi_investor_category_defs (
  id          serial primary key,
  slug        text not null unique,
  label       text not null,
  -- stage | vehicle | thesis | mandate | horizon | geo_scope
  facet       text not null
              check (facet in ('stage', 'vehicle', 'thesis', 'mandate', 'horizon', 'geo_scope')),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists kyi_investor_category_defs_facet_idx
  on public.kyi_investor_category_defs (facet, sort_order);

create table if not exists public.kyi_global_investor_categories (
  global_investor_id bigint not null
    references public.kyi_global_investors(id) on delete cascade,
  category_id        integer not null
    references public.kyi_investor_category_defs(id) on delete cascade,
  source             text not null default 'platform'
                     check (source in ('platform', 'tenant', 'auto')),
  created_at         timestamptz not null default now(),
  primary key (global_investor_id, category_id)
);

create index if not exists kyi_global_investor_categories_cat_idx
  on public.kyi_global_investor_categories (category_id);

-- -----------------------------------------------------------------------------
-- 3. Link private investors + leads → global identity
--     Also ensure lead enrichment columns exist (from system-update migration)
-- -----------------------------------------------------------------------------
alter table public.kyi_investors
  add column if not exists global_investor_id bigint
    references public.kyi_global_investors(id) on delete set null;

alter table public.kyi_investor_leads
  add column if not exists global_investor_id bigint
    references public.kyi_global_investors(id) on delete set null;

-- Required for backfill / app KYI APIs (idempotent if already present)
alter table public.kyi_investor_leads
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists investor_type_id integer,
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists enrichment_source text,
  add column if not exists enrichment_confidence double precision,
  add column if not exists organization_id uuid references public.organizations(id) on delete set null;

-- Normalize null metadata so jsonb operators are safe
update public.kyi_investor_leads
set metadata = '{}'::jsonb
where metadata is null;

create index if not exists kyi_investors_global_investor_id_idx
  on public.kyi_investors (global_investor_id);
create index if not exists kyi_investor_leads_global_investor_id_idx
  on public.kyi_investor_leads (global_investor_id);
create index if not exists kyi_investor_leads_organization_id_idx
  on public.kyi_investor_leads (organization_id);

-- -----------------------------------------------------------------------------
-- 4. Seed category definitions (PDF taxonomy as facets)
-- -----------------------------------------------------------------------------
insert into public.kyi_investor_category_defs (slug, label, facet, sort_order) values
  -- horizon
  ('long-term', 'Long-Term Investors', 'horizon', 10),
  ('short-term', 'Short-Term Investors', 'horizon', 20),
  -- thesis
  ('esg-environmental', 'ESG / Environmental Investors', 'thesis', 10),
  ('healthcare', 'Healthcare Investors', 'thesis', 20),
  ('technology', 'Technology Investors', 'thesis', 30),
  ('ai', 'AI Investors', 'thesis', 40),
  ('fintech', 'FinTech Investors', 'thesis', 50),
  ('real-estate', 'Real Estate Investors', 'thesis', 60),
  ('manufacturing', 'Manufacturing Investors', 'thesis', 70),
  ('consumer-products', 'Consumer Products', 'thesis', 80),
  -- vehicle
  ('venture-capital', 'Venture Capital', 'vehicle', 10),
  ('private-equity', 'Private Equity', 'vehicle', 20),
  ('family-offices', 'Family Offices', 'vehicle', 30),
  ('angel-investors', 'Angel Investors', 'vehicle', 40),
  ('growth-equity', 'Growth Equity', 'vehicle', 50),
  ('corporate-venture', 'Corporate Venture Capital', 'vehicle', 60),
  -- mandate
  ('impact', 'Impact Investors', 'mandate', 10),
  ('women-led', 'Women-Led Funds', 'mandate', 20),
  ('minority-focused', 'Minority-Focused Funds', 'mandate', 30),
  -- geo
  ('international', 'International Investors', 'geo_scope', 10),
  -- stage
  ('seed', 'Seed Investors', 'stage', 10),
  ('series-a', 'Series A Investors', 'stage', 20),
  ('series-b-plus', 'Series B+ Investors', 'stage', 30)
on conflict (slug) do update
  set label = excluded.label,
      facet = excluded.facet,
      sort_order = excluded.sort_order;

-- -----------------------------------------------------------------------------
-- 5. Helpers: dedupe key + network counts (aggregate only — no org names)
-- -----------------------------------------------------------------------------
create or replace function public.kyi_investor_dedupe_key(p_name text, p_firm text)
returns text
language sql
immutable
as $$
  select lower(trim(coalesce(p_name, ''))) || '|' || lower(trim(coalesce(p_firm, '')));
$$;

create or replace function public.kyi_global_investor_org_counts(p_ids bigint[])
returns table (global_investor_id bigint, org_count integer)
language sql
stable
security definer
set search_path = public
as $$
  select i.global_investor_id,
         count(distinct i.organization_id)::integer as org_count
  from public.kyi_investors i
  where i.global_investor_id = any (p_ids)
    and i.organization_id is not null
  group by i.global_investor_id;
$$;

grant execute on function public.kyi_global_investor_org_counts(bigint[]) to authenticated;
grant execute on function public.kyi_investor_dedupe_key(text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 6. RLS
-- -----------------------------------------------------------------------------
alter table public.kyi_global_investors enable row level security;
alter table public.kyi_investor_category_defs enable row level security;
alter table public.kyi_global_investor_categories enable row level security;

drop policy if exists "kyi_global_investors_select" on public.kyi_global_investors;
create policy "kyi_global_investors_select" on public.kyi_global_investors
  for select to authenticated using (true);

drop policy if exists "kyi_global_investors_insert" on public.kyi_global_investors;
create policy "kyi_global_investors_insert" on public.kyi_global_investors
  for insert to authenticated
  with check (auth.uid() is not null);

drop policy if exists "kyi_global_investors_update" on public.kyi_global_investors;
create policy "kyi_global_investors_update" on public.kyi_global_investors
  for update to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- No delete for tenants — platform/admin only via service role

drop policy if exists "kyi_category_defs_select" on public.kyi_investor_category_defs;
create policy "kyi_category_defs_select" on public.kyi_investor_category_defs
  for select to authenticated using (true);

drop policy if exists "kyi_global_investor_categories_select" on public.kyi_global_investor_categories;
create policy "kyi_global_investor_categories_select" on public.kyi_global_investor_categories
  for select to authenticated using (true);

drop policy if exists "kyi_global_investor_categories_write" on public.kyi_global_investor_categories;
create policy "kyi_global_investor_categories_write" on public.kyi_global_investor_categories
  for all to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- -----------------------------------------------------------------------------
-- 7. Backfill global directory from existing org investors + platform leads
-- -----------------------------------------------------------------------------
insert into public.kyi_global_investors (
  entity_type, display_name, firm, title, location, industry, profile_url,
  dedupe_key, source, created_at, updated_at
)
select distinct on (public.kyi_investor_dedupe_key(i.full_name, i.firm))
  'person',
  trim(i.full_name),
  nullif(trim(coalesce(i.firm, '')), ''),
  nullif(trim(coalesce(i.title, '')), ''),
  nullif(trim(coalesce(i.location, '')), ''),
  nullif(trim(coalesce(i.industry, '')), ''),
  nullif(trim(coalesce(i.profile_url, '')), ''),
  public.kyi_investor_dedupe_key(i.full_name, i.firm),
  'tenant',
  coalesce(i.created_at, now()),
  now()
from public.kyi_investors i
where trim(coalesce(i.full_name, '')) <> ''
  and public.kyi_investor_dedupe_key(i.full_name, i.firm) <> '|'
order by public.kyi_investor_dedupe_key(i.full_name, i.firm), i.id
on conflict (dedupe_key) do nothing;

insert into public.kyi_global_investors (
  entity_type, display_name, firm, title, location, industry, profile_url,
  geo_lat, geo_lng, firm_metadata, dedupe_key, source, created_at, updated_at
)
select distinct on (
  public.kyi_investor_dedupe_key(
    l.display_name,
    coalesce(l.metadata->>'firm', l.metadata->>'company', '')
  )
)
  case when l.entity_type = 'firm' then 'firm' else 'person' end,
  trim(l.display_name),
  nullif(trim(coalesce(l.metadata->>'firm', l.metadata->>'company', '')), ''),
  nullif(trim(coalesce(l.metadata->>'title', '')), ''),
  nullif(trim(concat_ws(', ', nullif(l.city, ''), nullif(l.state, ''))), ''),
  nullif(trim(coalesce(l.metadata->>'industry', '')), ''),
  nullif(trim(coalesce(l.metadata->>'profile_url', l.metadata->>'url', '')), ''),
  l.lat,
  l.lng,
  jsonb_build_object(
    'imported_from', 'quality_lead',
    'lead_id', l.id,
    'sources', coalesce(l.sources, '[]'::jsonb),
    'signals', coalesce(l.signals, '{}'::jsonb)
  ) || coalesce(l.metadata, '{}'::jsonb),
  public.kyi_investor_dedupe_key(
    l.display_name,
    coalesce(l.metadata->>'firm', l.metadata->>'company', '')
  ),
  'lead_import',
  coalesce(l.created_at, now()),
  now()
from public.kyi_investor_leads l
where (l.organization_id is null)
  and trim(coalesce(l.display_name, '')) <> ''
  -- High-quality public sources only (exclude FEC / Reddit / GitHub / Mastodon / etc.)
  and (
    exists (
      select 1
      from jsonb_array_elements(coalesce(l.sources, '[]'::jsonb)) s
      where upper(trim(coalesce(s->>'source_name', ''))) in (
        'SEC_13F', 'SEC_ADV', 'SEC_FORM_D', 'SEC_13D', 'SEC_13G',
        'SEC_FORM3', 'SEC_FORM4', 'SEC_FORM5', 'WIKIDATA', 'FINRA',
        'OPENCORPORATES', 'COMPANIES_HOUSE', 'SEDAR'
      )
    )
    or coalesce((l.signals->>'sec_13f')::boolean, false)
    or coalesce((l.signals->>'sec_adv')::boolean, false)
    or coalesce((l.signals->>'sec_form_d')::boolean, false)
    or coalesce((l.signals->>'sec_13d')::boolean, false)
    or coalesce((l.signals->>'sec_13g')::boolean, false)
    or coalesce((l.signals->>'sec_form3')::boolean, false)
    or coalesce((l.signals->>'sec_form4')::boolean, false)
    or coalesce((l.signals->>'sec_form5')::boolean, false)
    or coalesce((l.signals->>'finra_brokercheck')::boolean, false)
    or coalesce((l.signals->>'opencorporates')::boolean, false)
    or coalesce((l.signals->>'companies_house')::boolean, false)
    or coalesce((l.signals->>'sedar')::boolean, false)
  )
  and lower(trim(l.display_name)) !~ '^[a-z0-9_.-]+$'
  and public.kyi_investor_dedupe_key(
    l.display_name,
    coalesce(l.metadata->>'firm', l.metadata->>'company', '')
  ) <> '|'
order by
  public.kyi_investor_dedupe_key(
    l.display_name,
    coalesce(l.metadata->>'firm', l.metadata->>'company', '')
  ),
  l.id
on conflict (dedupe_key) do nothing;

-- Link private investors
update public.kyi_investors i
set global_investor_id = g.id
from public.kyi_global_investors g
where i.global_investor_id is null
  and g.dedupe_key = public.kyi_investor_dedupe_key(i.full_name, i.firm);

-- Link platform leads (quality sources only — see quality-cleanup migration)
update public.kyi_investor_leads l
set global_investor_id = g.id
from public.kyi_global_investors g
where l.global_investor_id is null
  and l.organization_id is null
  and (
    exists (
      select 1
      from jsonb_array_elements(coalesce(l.sources, '[]'::jsonb)) s
      where upper(trim(coalesce(s->>'source_name', ''))) in (
        'SEC_13F', 'SEC_ADV', 'SEC_FORM_D', 'SEC_13D', 'SEC_13G',
        'SEC_FORM3', 'SEC_FORM4', 'SEC_FORM5', 'WIKIDATA', 'FINRA',
        'OPENCORPORATES', 'COMPANIES_HOUSE', 'SEDAR'
      )
    )
    or coalesce((l.signals->>'sec_13f')::boolean, false)
    or coalesce((l.signals->>'sec_adv')::boolean, false)
    or coalesce((l.signals->>'sec_form_d')::boolean, false)
    or coalesce((l.signals->>'finra_brokercheck')::boolean, false)
  )
  and g.dedupe_key = public.kyi_investor_dedupe_key(
    l.display_name,
    coalesce(l.metadata->>'firm', l.metadata->>'company', '')
  );

-- -----------------------------------------------------------------------------
-- 8. Lightweight auto-categorization from industry/focus keywords
-- -----------------------------------------------------------------------------
insert into public.kyi_global_investor_categories (global_investor_id, category_id, source)
select g.id, c.id, 'auto'
from public.kyi_global_investors g
cross join public.kyi_investor_category_defs c
where (
  (c.slug = 'healthcare' and (
    lower(coalesce(g.industry, '')) ~ 'health|biotech|pharma|medtech'
    or lower(coalesce(g.investment_focus, '')) ~ 'health|biotech|pharma'
  ))
  or (c.slug = 'ai' and (
    lower(coalesce(g.industry, '')) ~ '\yai\b|artificial intelligence|machine learning'
    or lower(coalesce(g.investment_focus, '')) ~ '\yai\b|artificial intelligence'
  ))
  or (c.slug = 'fintech' and (
    lower(coalesce(g.industry, '')) ~ 'fintech|financial tech|payments'
    or lower(coalesce(g.investment_focus, '')) ~ 'fintech|payments'
  ))
  or (c.slug = 'technology' and (
    lower(coalesce(g.industry, '')) ~ 'tech|software|saas|cloud'
  ))
  or (c.slug = 'real-estate' and (
    lower(coalesce(g.industry, '')) ~ 'real estate|proptech|realty'
  ))
  or (c.slug = 'venture-capital' and (
    lower(coalesce(g.firm, '')) ~ '\bvc\b|venture'
    or lower(coalesce(g.display_name, '')) ~ 'ventures'
  ))
  or (c.slug = 'private-equity' and (
    lower(coalesce(g.firm, '')) ~ 'private equity|\bpe\b|capital partners'
  ))
  or (c.slug = 'family-offices' and (
    lower(coalesce(g.firm, '')) ~ 'family office'
  ))
  or (c.slug = 'angel-investors' and (
    lower(coalesce(g.title, '')) ~ 'angel'
    or lower(coalesce(g.firm, '')) ~ 'angel'
  ))
  or (c.slug = 'growth-equity' and (
    lower(coalesce(g.firm, '')) ~ 'growth equity|growth capital'
  ))
  or (c.slug = 'seed' and (
    lower(coalesce(g.investment_focus, '')) ~ '\bseed\b'
    or lower(coalesce(g.title, '')) ~ 'seed'
  ))
  or (c.slug = 'series-a' and (
    lower(coalesce(g.investment_focus, '')) ~ 'series a'
  ))
  or (c.slug = 'series-b-plus' and (
    lower(coalesce(g.investment_focus, '')) ~ 'series [b-z]|growth stage'
  ))
  or (c.slug = 'esg-environmental' and (
    lower(coalesce(g.industry, '') || ' ' || coalesce(g.investment_focus, '')) ~ 'esg|climate|clean energy|sustainab'
  ))
  or (c.slug = 'impact' and (
    lower(coalesce(g.investment_focus, '')) ~ 'impact invest'
  ))
  or (c.slug = 'international' and (
    lower(coalesce(g.location, '')) ~ 'uk|london|europe|asia|singapore|dubai|canada|australia'
    or lower(coalesce(g.firm_metadata->>'country', '')) not in ('', 'us', 'usa', 'united states')
  ))
)
on conflict do nothing;
