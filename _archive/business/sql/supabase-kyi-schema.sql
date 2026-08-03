-- =============================================================================
-- Katana KYI (Know Your Investor) – Supabase schema
-- Run this in Supabase Dashboard → SQL Editor to create the KYI tables.
--
-- Notes:
-- - This schema is a Postgres adaptation of the original KYI SQLite schema
--   in the separate KYI Flask app. It is designed so the React KYI module
--   can run entirely against Supabase without a separate Flask service.
-- - IDs are numeric (serial) to match the existing frontend types
--   (KYICompany.id, KYIInvestor.id, KYILead.id are numbers).
-- - Multi-tenant scoping by organization can be added later by adding an
--   organization_id UUID column referencing public.organizations(id).
-- =============================================================================

create extension if not exists "uuid-ossp";

-- -----------------------------------------------------------------------------
-- kyi_companies
-- -----------------------------------------------------------------------------
-- Companies: KYI recommendations and investors are scoped per company.
-- Mirrors the original SQLite `companies` table plus a logo_url column.

create table if not exists public.kyi_companies (
  id          serial primary key,
  name        text not null,
  location    text,
  industry    text,
  website     text,
  description text,
  logo_url    text,
  created_at  timestamptz not null default now()
);

create index if not exists kyi_companies_name_idx on public.kyi_companies(name);

-- -----------------------------------------------------------------------------
-- kyi_investors
-- -----------------------------------------------------------------------------
-- Investors associated with a KYI company.

create table if not exists public.kyi_investors (
  id          serial primary key,
  company_id  integer references public.kyi_companies(id) on delete cascade,
  full_name   text not null,
  email       text,
  phone       text,
  location    text,
  industry    text,
  firm        text,
  title       text,
  profile_url text,
  notes       text,
  created_at  timestamptz,
  updated_at  timestamptz
);

create index if not exists kyi_investors_company_id_idx on public.kyi_investors(company_id);
create index if not exists kyi_investors_full_name_idx on public.kyi_investors(full_name);

-- -----------------------------------------------------------------------------
-- kyi_client_geo_settings
-- -----------------------------------------------------------------------------
-- Per-company geo targeting settings (center + radius + bounding box).
-- Mirrors SQLite client_geo_settings.

create table if not exists public.kyi_client_geo_settings (
  id            serial primary key,
  client_id     integer not null references public.kyi_companies(id) on delete cascade,
  location_label text not null,
  center_lat    double precision not null,
  center_lng    double precision not null,
  radius_miles  double precision not null default 50,
  bbox_min_lat  double precision not null,
  bbox_max_lat  double precision not null,
  bbox_min_lng  double precision not null,
  bbox_max_lng  double precision not null,
  updated_at    timestamptz not null default now(),
  unique (client_id)
);

create index if not exists kyi_geo_settings_client_idx on public.kyi_client_geo_settings(client_id);

-- -----------------------------------------------------------------------------
-- kyi_investor_geo_settings
-- -----------------------------------------------------------------------------
-- Per-investor geo targeting settings (center + radius + bounding box).
-- Same structure as kyi_client_geo_settings but keyed by investor_id.

create table if not exists public.kyi_investor_geo_settings (
  id            serial primary key,
  investor_id   integer not null references public.kyi_investors(id) on delete cascade,
  location_label text not null,
  center_lat    double precision not null,
  center_lng    double precision not null,
  radius_miles  double precision not null default 50,
  bbox_min_lat  double precision not null,
  bbox_max_lat  double precision not null,
  bbox_min_lng  double precision not null,
  bbox_max_lng  double precision not null,
  updated_at    timestamptz not null default now(),
  unique (investor_id)
);

create index if not exists kyi_geo_settings_investor_idx on public.kyi_investor_geo_settings(investor_id);

-- -----------------------------------------------------------------------------
-- kyi_investor_leads
-- -----------------------------------------------------------------------------
-- Investor leads (multi-tenant, geo-enabled).
-- Mirrors SQLite investor_leads.

create table if not exists public.kyi_investor_leads (
  id           serial primary key,
  client_id    integer not null references public.kyi_companies(id) on delete cascade,
  entity_type  text not null check (entity_type in ('person', 'firm')),
  display_name text not null,
  street_address text,
  city         text,
  state        text,
  zip_code     text,
  country      text default 'US',
  lat          double precision,
  lng          double precision,
  sources      jsonb,          -- JSON array of {source_name, source_id, url, confidence}
  signals      jsonb,          -- JSON object with signal flags and dates
  raw_score    integer default 0,
  score_breakdown jsonb,       -- JSON object with score details
  tags         jsonb,          -- JSON array of tag IDs / names
  created_at   timestamptz,
  updated_at   timestamptz
);

create index if not exists kyi_leads_client_idx on public.kyi_investor_leads(client_id);
create index if not exists kyi_leads_client_geo_idx on public.kyi_investor_leads(client_id, lat, lng);
create index if not exists kyi_leads_client_score_idx on public.kyi_investor_leads(client_id, raw_score desc);
create index if not exists kyi_leads_entity_type_idx on public.kyi_investor_leads(client_id, entity_type);

-- -----------------------------------------------------------------------------
-- kyi_lead_profile_intel
-- -----------------------------------------------------------------------------
-- Structured, actionable intelligence for a lead.

create table if not exists public.kyi_lead_profile_intel (
  id                    serial primary key,
  lead_id               integer not null references public.kyi_investor_leads(id) on delete cascade,
  client_id             integer not null references public.kyi_companies(id) on delete cascade,
  investor_type         text,
  motivations           text,
  cares_about_most      jsonb,  -- JSON array
  decision_drivers      jsonb,  -- JSON array
  red_flags             jsonb,  -- JSON array
  green_flags           jsonb,  -- JSON array
  ideal_messaging_approach text,
  example_outreach_angles jsonb, -- JSON array
  notes_next_steps      text,
  created_at            timestamptz,
  updated_at            timestamptz,
  unique (lead_id, client_id)
);

create index if not exists kyi_lead_intel_lead_idx on public.kyi_lead_profile_intel(lead_id, client_id);

-- -----------------------------------------------------------------------------
-- kyi_geocode_cache
-- -----------------------------------------------------------------------------
-- Cache from normalized address key -> lat/lng.

create table if not exists public.kyi_geocode_cache (
  address_key text primary key,
  lat         double precision not null,
  lng         double precision not null,
  cached_at   timestamptz not null default now()
);

create index if not exists kyi_geocode_cache_key_idx on public.kyi_geocode_cache(address_key);

-- -----------------------------------------------------------------------------
-- kyi_geocode_jobs
-- -----------------------------------------------------------------------------
-- Background geocoding jobs for leads.

create table if not exists public.kyi_geocode_jobs (
  id           serial primary key,
  lead_id      integer not null references public.kyi_investor_leads(id) on delete cascade,
  client_id    integer not null references public.kyi_companies(id) on delete cascade,
  address_input text not null,
  status       text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  attempts     integer default 0,
  last_error   text,
  result_lat   double precision,
  result_lng   double precision,
  created_at   timestamptz,
  updated_at   timestamptz
);

create index if not exists kyi_geocode_jobs_status_idx on public.kyi_geocode_jobs(status, client_id);
create index if not exists kyi_geocode_jobs_lead_idx on public.kyi_geocode_jobs(lead_id);

-- -----------------------------------------------------------------------------
-- kyi_entities
-- -----------------------------------------------------------------------------
-- Unified entity table with best resolved location.

create table if not exists public.kyi_entities (
  id                     serial primary key,
  client_id              integer not null,
  entity_type            text not null default 'person' check (entity_type in ('person', 'firm', 'org', 'unknown')),
  display_name           text not null,
  primary_email          text,
  website                text,
  best_location_lat      double precision,
  best_location_lng      double precision,
  best_location_tier     text default 'D' check (best_location_tier in ('A', 'B', 'C', 'D')),
  best_location_confidence double precision default 0.0,
  best_location_label    text,
  best_location_source   text,
  created_at             timestamptz,
  updated_at             timestamptz
);

create index if not exists kyi_entities_client_idx on public.kyi_entities(client_id);
create index if not exists kyi_entities_client_tier_idx on public.kyi_entities(client_id, best_location_tier);
create index if not exists kyi_entities_client_geo_idx on public.kyi_entities(client_id, best_location_lat, best_location_lng);
create index if not exists kyi_entities_type_idx on public.kyi_entities(client_id, entity_type);

-- -----------------------------------------------------------------------------
-- kyi_location_claims
-- -----------------------------------------------------------------------------
-- Audit trail of all location evidence for entities.

create table if not exists public.kyi_location_claims (
  id           serial primary key,
  client_id    integer not null,
  entity_id    integer not null references public.kyi_entities(id) on delete cascade,
  source_name  text not null,
  raw_text     text not null,
  normalized_label text,
  lat          double precision,
  lng          double precision,
  precision    text default 'unknown' check (precision in ('rooftop', 'street', 'zip', 'city', 'county', 'state', 'country', 'unknown')),
  tier         text default 'D' check (tier in ('A', 'B', 'C', 'D')),
  confidence   double precision default 0.0,
  evidence_url text,
  captured_at  timestamptz
);

create index if not exists kyi_location_claims_entity_idx on public.kyi_location_claims(client_id, entity_id);
create index if not exists kyi_location_claims_tier_idx on public.kyi_location_claims(client_id, tier);
create index if not exists kyi_location_claims_geo_idx on public.kyi_location_claims(client_id, lat, lng);
create index if not exists kyi_location_claims_source_idx on public.kyi_location_claims(client_id, source_name);

-- -----------------------------------------------------------------------------
-- kyi_claim_geocode_jobs
-- -----------------------------------------------------------------------------
-- Background geocoding jobs for location_claims.

create table if not exists public.kyi_claim_geocode_jobs (
  id         serial primary key,
  client_id  integer not null,
  claim_id   integer not null references public.kyi_location_claims(id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  attempts   integer default 0,
  last_error text,
  created_at timestamptz,
  updated_at timestamptz
);

create index if not exists kyi_claim_geocode_jobs_status_idx on public.kyi_claim_geocode_jobs(status, client_id);
create index if not exists kyi_claim_geocode_jobs_claim_idx on public.kyi_claim_geocode_jobs(claim_id);

-- -----------------------------------------------------------------------------
-- Convenience view: companies with investor_count
-- -----------------------------------------------------------------------------

create or replace view public.kyi_companies_with_counts as
select
  c.*,
  coalesce((
    select count(*) from public.kyi_investors i where i.company_id = c.id
  ), 0) as investor_count
from public.kyi_companies c;

-- Simple leads view – base for localized leads API
create or replace view public.kyi_leads_for_client as
select
  l.*
from public.kyi_investor_leads l;

-- -----------------------------------------------------------------------------
-- Row Level Security (RLS) – allow all for now (like other module schemas)
-- -----------------------------------------------------------------------------

alter table public.kyi_companies           enable row level security;
alter table public.kyi_investors           enable row level security;
alter table public.kyi_client_geo_settings enable row level security;
alter table public.kyi_investor_geo_settings enable row level security;
alter table public.kyi_investor_leads      enable row level security;
alter table public.kyi_lead_profile_intel  enable row level security;
alter table public.kyi_geocode_cache       enable row level security;
alter table public.kyi_geocode_jobs        enable row level security;
alter table public.kyi_entities            enable row level security;
alter table public.kyi_location_claims     enable row level security;
alter table public.kyi_claim_geocode_jobs  enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'kyi_companies') then
    create policy "Allow all on kyi_companies" on public.kyi_companies for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'kyi_investors') then
    create policy "Allow all on kyi_investors" on public.kyi_investors for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'kyi_client_geo_settings') then
    create policy "Allow all on kyi_client_geo_settings" on public.kyi_client_geo_settings for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'kyi_investor_geo_settings') then
    create policy "Allow all on kyi_investor_geo_settings" on public.kyi_investor_geo_settings for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'kyi_investor_leads') then
    create policy "Allow all on kyi_investor_leads" on public.kyi_investor_leads for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'kyi_lead_profile_intel') then
    create policy "Allow all on kyi_lead_profile_intel" on public.kyi_lead_profile_intel for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'kyi_geocode_cache') then
    create policy "Allow all on kyi_geocode_cache" on public.kyi_geocode_cache for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'kyi_geocode_jobs') then
    create policy "Allow all on kyi_geocode_jobs" on public.kyi_geocode_jobs for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'kyi_entities') then
    create policy "Allow all on kyi_entities" on public.kyi_entities for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'kyi_location_claims') then
    create policy "Allow all on kyi_location_claims" on public.kyi_location_claims for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'kyi_claim_geocode_jobs') then
    create policy "Allow all on kyi_claim_geocode_jobs" on public.kyi_claim_geocode_jobs for all using (true) with check (true);
  end if;
end
$$;

