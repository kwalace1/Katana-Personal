-- =============================================================================
-- Seed the KYI primary company for the Katana / platform organization ONLY.
-- Run after supabase-kyi-schema.sql + org RLS migration.
-- Requires an organizations row (Katana or platform). Will no-op if not found.
-- =============================================================================

do $$
declare
  platform_org uuid;
begin
  select id into platform_org
  from public.organizations
  where name ilike '%katana business%'
     or name ilike '%katana tech%'
     or slug ilike '%katana%'
  order by created_at asc
  limit 1;

  if platform_org is null then
    raise notice 'kyi-seed-demo-company: no Katana/platform organization found; skipping seed';
    return;
  end if;

  insert into public.kyi_companies (
    id, name, location, industry, website, description, organization_id, created_at
  )
  values (
    1,
    'Katana Business Solutions',
    'Long Island, NY',
    'B2B SaaS',
    'https://katana-vv2.vercel.app',
    'Internal investor target database & outreach tracker (Northstar).',
    platform_org,
    now()
  )
  on conflict (id) do update set
    name = excluded.name,
    location = excluded.location,
    industry = excluded.industry,
    website = excluded.website,
    organization_id = excluded.organization_id;

  insert into public.kyi_client_geo_settings (
    client_id, location_label, center_lat, center_lng, radius_miles,
    bbox_min_lat, bbox_max_lat, bbox_min_lng, bbox_max_lng, organization_id, updated_at
  )
  values (
    1,
    'Long Island, NY',
    40.7891, -73.1350,
    50,
    40.0649, 41.5133, -73.9701, -72.2999,
    platform_org,
    now()
  )
  on conflict (client_id) do update set
    location_label = excluded.location_label,
    center_lat = excluded.center_lat,
    center_lng = excluded.center_lng,
    radius_miles = excluded.radius_miles,
    bbox_min_lat = excluded.bbox_min_lat,
    bbox_max_lat = excluded.bbox_max_lat,
    bbox_min_lng = excluded.bbox_min_lng,
    bbox_max_lng = excluded.bbox_max_lng,
    organization_id = excluded.organization_id,
    updated_at = excluded.updated_at;
end $$;
