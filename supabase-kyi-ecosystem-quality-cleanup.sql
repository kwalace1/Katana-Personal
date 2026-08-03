-- =============================================================================
-- KYI ecosystem quality filter
-- Run AFTER or AFTER re-running ecosystem backfill.
--
-- Removes noisy social/political scrape rows from the shared directory and
-- re-links only high-quality public sources + tenant investors.
--
-- KEEP (lead sources / signals):
--   SEC_13F, SEC_ADV, SEC_FORM_D, SEC_13D/G, SEC Form 3/4/5,
--   Wikidata, FINRA, OpenCorporates, Companies House, SEDAR
--
-- DROP (lead sources):
--   FEC, GitHub, Mastodon, Reddit, NewsFunding, GDELT,
--   USPTO, Lobbying, Press, KYI graph edges/nodes without a keep source
-- =============================================================================

-- Ensure enrichment columns exist (safe if already applied)
alter table public.kyi_investor_leads
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists organization_id uuid references public.organizations(id) on delete set null;

update public.kyi_investor_leads set metadata = '{}'::jsonb where metadata is null;

-- Helper: true when a lead has at least one high-quality source or signal
create or replace function public.kyi_lead_is_ecosystem_quality(p_sources jsonb, p_signals jsonb)
returns boolean
language sql
immutable
as $$
  select
    -- Quality source_name values from import pipeline
    exists (
      select 1
      from jsonb_array_elements(coalesce(p_sources, '[]'::jsonb)) s
      where upper(trim(coalesce(s->>'source_name', ''))) in (
        'SEC_13F',
        'SEC_ADV',
        'SEC_FORM_D',
        'SEC_13D',
        'SEC_13G',
        'SEC_FORM3',
        'SEC_FORM4',
        'SEC_FORM5',
        'WIKIDATA',
        'FINRA',
        'OPENCORPORATES',
        'COMPANIES_HOUSE',
        'SEDAR'
      )
    )
    -- Or quality signal flags
    or coalesce((p_signals->>'sec_13f')::boolean, false)
    or coalesce((p_signals->>'sec_adv')::boolean, false)
    or coalesce((p_signals->>'sec_form_d')::boolean, false)
    or coalesce((p_signals->>'sec_13d')::boolean, false)
    or coalesce((p_signals->>'sec_13g')::boolean, false)
    or coalesce((p_signals->>'sec_form3')::boolean, false)
    or coalesce((p_signals->>'sec_form4')::boolean, false)
    or coalesce((p_signals->>'sec_form5')::boolean, false)
    or coalesce((p_signals->>'finra_brokercheck')::boolean, false)
    or coalesce((p_signals->>'opencorporates')::boolean, false)
    or coalesce((p_signals->>'companies_house')::boolean, false)
    or coalesce((p_signals->>'sedar')::boolean, false);
$$;

grant execute on function public.kyi_lead_is_ecosystem_quality(jsonb, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- 1. Unlink leads that are NOT quality from global directory
-- -----------------------------------------------------------------------------
update public.kyi_investor_leads l
set global_investor_id = null,
    updated_at = now()
where l.global_investor_id is not null
  and not public.kyi_lead_is_ecosystem_quality(l.sources, l.signals);

-- -----------------------------------------------------------------------------
-- 2. Delete lead_import globals that no longer have any quality lead
--    (keep tenant-contributed / enriched / platform-curated rows)
--    Also keep any global still linked from a private kyi_investors row.
-- -----------------------------------------------------------------------------
delete from public.kyi_global_investor_categories gc
using public.kyi_global_investors g
where gc.global_investor_id = g.id
  and g.source = 'lead_import'
  and not exists (
    select 1 from public.kyi_investors i where i.global_investor_id = g.id
  )
  and not exists (
    select 1
    from public.kyi_investor_leads l
    where l.global_investor_id = g.id
      and public.kyi_lead_is_ecosystem_quality(l.sources, l.signals)
  );

delete from public.kyi_global_investors g
where g.source = 'lead_import'
  and not exists (
    select 1 from public.kyi_investors i where i.global_investor_id = g.id
  )
  and not exists (
    select 1
    from public.kyi_investor_leads l
    where l.global_investor_id = g.id
      and public.kyi_lead_is_ecosystem_quality(l.sources, l.signals)
  );

-- Extra safety: drop remaining lead_import rows whose firm_metadata/sources
-- only reference noise feeds (covers orphans created before quality helper)
delete from public.kyi_global_investor_categories gc
using public.kyi_global_investors g
where gc.global_investor_id = g.id
  and g.source = 'lead_import'
  and not exists (select 1 from public.kyi_investors i where i.global_investor_id = g.id)
  and (
    lower(g.display_name) ~ '^[a-z0-9_.-]+$'  -- handle-like (reddit/github-ish)
    or exists (
      select 1
      from jsonb_array_elements(
        case
          when jsonb_typeof(g.firm_metadata->'sources') = 'array' then g.firm_metadata->'sources'
          else '[]'::jsonb
        end
      ) s
      where upper(trim(coalesce(s->>'source_name', ''))) in (
        'FEC', 'GITHUB', 'MASTODON', 'REDDIT', 'REDDIT_VENTURECAPITAL',
        'NEWSFUNDING', 'GDELT', 'USPTO', 'LOBBYING_SENATE', 'LOBBYING_HOUSE',
        'PRESS', 'KYI_EDGES', 'KYI_NODES'
      )
    )
  );

delete from public.kyi_global_investors g
where g.source = 'lead_import'
  and not exists (select 1 from public.kyi_investors i where i.global_investor_id = g.id)
  and (
    lower(g.display_name) ~ '^[a-z0-9_.-]+$'
    or exists (
      select 1
      from jsonb_array_elements(
        case
          when jsonb_typeof(g.firm_metadata->'sources') = 'array' then g.firm_metadata->'sources'
          else '[]'::jsonb
        end
      ) s
      where upper(trim(coalesce(s->>'source_name', ''))) in (
        'FEC', 'GITHUB', 'MASTODON', 'REDDIT', 'REDDIT_VENTURECAPITAL',
        'NEWSFUNDING', 'GDELT', 'USPTO', 'LOBBYING_SENATE', 'LOBBYING_HOUSE',
        'PRESS', 'KYI_EDGES', 'KYI_NODES'
      )
    )
  );

-- -----------------------------------------------------------------------------
-- 3. Re-backfill ONLY quality platform leads (null org = shared catalog)
-- -----------------------------------------------------------------------------
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
where l.organization_id is null
  and trim(coalesce(l.display_name, '')) <> ''
  and public.kyi_lead_is_ecosystem_quality(l.sources, l.signals)
  and public.kyi_investor_dedupe_key(
    l.display_name,
    coalesce(l.metadata->>'firm', l.metadata->>'company', '')
  ) <> '|'
  -- skip handle-like noise even if mis-tagged
  and lower(trim(l.display_name)) !~ '^[a-z0-9_.-]+$'
order by
  public.kyi_investor_dedupe_key(
    l.display_name,
    coalesce(l.metadata->>'firm', l.metadata->>'company', '')
  ),
  l.id
on conflict (dedupe_key) do nothing;

-- Link quality leads
update public.kyi_investor_leads l
set global_investor_id = g.id,
    updated_at = now()
from public.kyi_global_investors g
where l.global_investor_id is null
  and l.organization_id is null
  and public.kyi_lead_is_ecosystem_quality(l.sources, l.signals)
  and g.dedupe_key = public.kyi_investor_dedupe_key(
    l.display_name,
    coalesce(l.metadata->>'firm', l.metadata->>'company', '')
  );

-- Ensure tenant investors remain linked / present
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

update public.kyi_investors i
set global_investor_id = g.id
from public.kyi_global_investors g
where i.global_investor_id is null
  and g.dedupe_key = public.kyi_investor_dedupe_key(i.full_name, i.firm);

-- Re-apply light auto-categories for any new rows missing them
insert into public.kyi_global_investor_categories (global_investor_id, category_id, source)
select g.id, c.id, 'auto'
from public.kyi_global_investors g
cross join public.kyi_investor_category_defs c
where not exists (
  select 1 from public.kyi_global_investor_categories x
  where x.global_investor_id = g.id and x.category_id = c.id
)
and (
  (c.slug = 'healthcare' and lower(coalesce(g.industry, '') || ' ' || coalesce(g.investment_focus, '')) ~ 'health|biotech|pharma|medtech')
  or (c.slug = 'ai' and lower(coalesce(g.industry, '') || ' ' || coalesce(g.investment_focus, '')) ~ '\yai\b|artificial intelligence|machine learning')
  or (c.slug = 'fintech' and lower(coalesce(g.industry, '') || ' ' || coalesce(g.investment_focus, '')) ~ 'fintech|financial tech|payments')
  or (c.slug = 'technology' and lower(coalesce(g.industry, '')) ~ 'tech|software|saas|cloud')
  or (c.slug = 'real-estate' and lower(coalesce(g.industry, '')) ~ 'real estate|proptech|realty')
  or (c.slug = 'venture-capital' and (lower(coalesce(g.firm, '')) ~ '\bvc\b|venture' or lower(coalesce(g.display_name, '')) ~ 'ventures'))
  or (c.slug = 'private-equity' and lower(coalesce(g.firm, '')) ~ 'private equity|\bpe\b|capital partners')
  or (c.slug = 'family-offices' and lower(coalesce(g.firm, '')) ~ 'family office')
  or (c.slug = 'angel-investors' and (lower(coalesce(g.title, '')) ~ 'angel' or lower(coalesce(g.firm, '')) ~ 'angel'))
  or (c.slug = 'growth-equity' and lower(coalesce(g.firm, '')) ~ 'growth equity|growth capital')
  or (c.slug = 'seed' and lower(coalesce(g.investment_focus, '') || ' ' || coalesce(g.title, '')) ~ '\bseed\b')
  or (c.slug = 'series-a' and lower(coalesce(g.investment_focus, '')) ~ 'series a')
  or (c.slug = 'series-b-plus' and lower(coalesce(g.investment_focus, '')) ~ 'series [b-z]|growth stage')
  or (c.slug = 'esg-environmental' and lower(coalesce(g.industry, '') || ' ' || coalesce(g.investment_focus, '')) ~ 'esg|climate|clean energy|sustainab')
  or (c.slug = 'impact' and lower(coalesce(g.investment_focus, '')) ~ 'impact invest')
  or (c.slug = 'international' and lower(coalesce(g.location, '')) ~ 'uk|london|europe|asia|singapore|dubai|canada|australia')
)
on conflict do nothing;

-- Quick counts for the SQL Editor output
select
  (select count(*) from public.kyi_global_investors) as global_investors,
  (select count(*) from public.kyi_global_investors where source = 'lead_import') as from_quality_leads,
  (select count(*) from public.kyi_global_investors where source = 'tenant') as from_tenant,
  (select count(*) from public.kyi_investor_leads where global_investor_id is not null) as leads_linked;
