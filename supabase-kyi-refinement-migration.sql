-- =============================================================================
-- KYI module refinement — run after supabase-kyi-schema.sql and system updates.
-- Idempotent: safe to re-run.
-- =============================================================================

-- Companies: raise profile + org scoping
ALTER TABLE public.kyi_companies
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS raise_stage text,
  ADD COLUMN IF NOT EXISTS raise_target_amount numeric,
  ADD COLUMN IF NOT EXISTS preferred_investor_types jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sector_tags jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS twitter_url text,
  ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS kyi_companies_organization_id_idx ON public.kyi_companies(organization_id);

-- Investors: lead lineage + outreach pipeline
ALTER TABLE public.kyi_investors
  ADD COLUMN IF NOT EXISTS source_lead_id integer REFERENCES public.kyi_investor_leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS outreach_status text NOT NULL DEFAULT 'new'
    CHECK (outreach_status IN ('new', 'contacted', 'meeting', 'passed')),
  ADD COLUMN IF NOT EXISTS lead_snapshot jsonb;

CREATE INDEX IF NOT EXISTS kyi_investors_source_lead_idx ON public.kyi_investors(source_lead_id);
CREATE INDEX IF NOT EXISTS kyi_investors_outreach_status_idx ON public.kyi_investors(company_id, outreach_status);

-- Multi-market geo targets (union filter in getLeads)
CREATE TABLE IF NOT EXISTS public.kyi_company_geo_targets (
  id            serial primary key,
  company_id    integer NOT NULL REFERENCES public.kyi_companies(id) ON DELETE CASCADE,
  location_label text NOT NULL,
  center_lat    double precision NOT NULL,
  center_lng    double precision NOT NULL,
  radius_miles  double precision NOT NULL DEFAULT 50,
  bbox_min_lat  double precision NOT NULL,
  bbox_max_lat  double precision NOT NULL,
  bbox_min_lng  double precision NOT NULL,
  bbox_max_lng  double precision NOT NULL,
  sort_order    integer NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kyi_company_geo_targets_company_idx
  ON public.kyi_company_geo_targets(company_id, is_active, sort_order);

-- Platform metadata (e.g. last_lead_import_at)
CREATE TABLE IF NOT EXISTS public.kyi_platform_metadata (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kyi_company_geo_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyi_platform_metadata ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'kyi_company_geo_targets'
      AND policyname = 'user_isolation_kyi_company_geo_targets'
  ) THEN
    CREATE POLICY user_isolation_kyi_company_geo_targets ON public.kyi_company_geo_targets
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.kyi_companies c
          WHERE c.id = kyi_company_geo_targets.company_id AND c.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.kyi_companies c
          WHERE c.id = kyi_company_geo_targets.company_id AND c.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'kyi_platform_metadata'
      AND policyname = 'authenticated_kyi_platform_metadata_read'
  ) THEN
    CREATE POLICY authenticated_kyi_platform_metadata_read ON public.kyi_platform_metadata
      FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'kyi_platform_metadata'
      AND policyname = 'service_kyi_platform_metadata_write'
  ) THEN
    CREATE POLICY service_kyi_platform_metadata_write ON public.kyi_platform_metadata
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
