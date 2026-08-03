-- =============================================================================
-- Katana KYC Phase 2 — lead geo fields for ICP fit scoring
-- Run after supabase-kyc-migration.sql
-- =============================================================================

ALTER TABLE public.cs_leads
  ADD COLUMN IF NOT EXISTS industry text;

ALTER TABLE public.cs_leads
  ADD COLUMN IF NOT EXISTS state text;

ALTER TABLE public.cs_leads
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.cs_leads.industry IS 'Industry for ICP fit scoring';
COMMENT ON COLUMN public.cs_leads.state IS 'State/region for ICP geo fit';
