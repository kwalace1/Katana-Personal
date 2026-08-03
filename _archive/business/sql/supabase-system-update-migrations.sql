-- =============================================================================
-- System update: KYI roles/segmentation/geo, leads metadata, trial fields,
-- job RBAC, data categories, job access audit.
-- Run in Supabase SQL Editor (idempotent IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- =============================================================================

-- Organizations: configurable trial / demo window
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS trial_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_end_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_duration_days integer DEFAULT 60;

-- KYI investors: classification & segmentation
ALTER TABLE public.kyi_investors
  ADD COLUMN IF NOT EXISTS user_role_classification text DEFAULT 'employee',
  ADD COLUMN IF NOT EXISTS added_via_orbit boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS segment_type text NOT NULL DEFAULT 'current_investor';

-- Geo preset level (national / regional / local)
ALTER TABLE public.kyi_client_geo_settings
  ADD COLUMN IF NOT EXISTS geo_segment_level text NOT NULL DEFAULT 'local';

ALTER TABLE public.kyi_investor_geo_settings
  ADD COLUMN IF NOT EXISTS geo_segment_level text NOT NULL DEFAULT 'local';

-- KYI leads: optional names, enrichment, org scoping, category metadata
ALTER TABLE public.kyi_investor_leads
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS investor_type_id integer,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS enrichment_source text,
  ADD COLUMN IF NOT EXISTS enrichment_confidence double precision,
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Data categories (e.g. Swing Data, Market Data)
CREATE TABLE IF NOT EXISTS public.kyi_data_categories (
  id serial primary key,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kyi_data_categories_org_slug_unique UNIQUE (organization_id, slug)
);

CREATE INDEX IF NOT EXISTS kyi_data_categories_org_idx ON public.kyi_data_categories(organization_id);

ALTER TABLE public.kyi_data_categories ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'kyi_data_categories' AND policyname = 'authenticated_kyi_data_categories_all'
  ) THEN
    CREATE POLICY "authenticated_kyi_data_categories_all" ON public.kyi_data_categories
      FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Job listings RBAC (default public so existing listings stay on Careers until changed)
ALTER TABLE public.job_postings
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS restricted_departments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS visible_to_roles jsonb,
  ADD COLUMN IF NOT EXISTS admin_visibility_override boolean NOT NULL DEFAULT false;

-- Audit: who opened a job listing (internal HR views)
CREATE TABLE IF NOT EXISTS public.job_listing_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accessed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_listing_access_log_job_idx ON public.job_listing_access_log(job_id);
CREATE INDEX IF NOT EXISTS job_listing_access_log_user_idx ON public.job_listing_access_log(user_id);

ALTER TABLE public.job_listing_access_log ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'job_listing_access_log' AND policyname = 'authenticated_job_access_log_insert'
  ) THEN
    CREATE POLICY "authenticated_job_access_log_insert" ON public.job_listing_access_log
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'job_listing_access_log' AND policyname = 'authenticated_job_access_log_select'
  ) THEN
    CREATE POLICY "authenticated_job_access_log_select" ON public.job_listing_access_log
      FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
END $$;
