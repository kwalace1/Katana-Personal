-- =============================================================================
-- Katana KYC — Phase 4 expansion (summary cache, coach cache, contact roles)
-- Run after supabase-kyc-migration.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Executive summary cache (cs_client_intel)
-- -----------------------------------------------------------------------------
ALTER TABLE public.cs_client_intel
  ADD COLUMN IF NOT EXISTS ai_summary text;

ALTER TABLE public.cs_client_intel
  ADD COLUMN IF NOT EXISTS summary_generated_at timestamptz;

ALTER TABLE public.cs_client_intel
  ADD COLUMN IF NOT EXISTS summary_context_hash text;

ALTER TABLE public.cs_client_intel
  ADD COLUMN IF NOT EXISTS coach_response text;

ALTER TABLE public.cs_client_intel
  ADD COLUMN IF NOT EXISTS coach_generated_at timestamptz;

ALTER TABLE public.cs_client_intel
  ADD COLUMN IF NOT EXISTS coach_context_hash text;

CREATE INDEX IF NOT EXISTS cs_client_intel_summary_hash_idx
  ON public.cs_client_intel(summary_context_hash)
  WHERE summary_context_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS cs_client_intel_coach_hash_idx
  ON public.cs_client_intel(coach_context_hash)
  WHERE coach_context_hash IS NOT NULL;

COMMENT ON COLUMN public.cs_client_intel.ai_summary IS 'Cached AI/template executive summary for the account overview';
COMMENT ON COLUMN public.cs_client_intel.summary_generated_at IS 'When ai_summary was last generated';
COMMENT ON COLUMN public.cs_client_intel.summary_context_hash IS 'Hash of intel inputs used to invalidate stale summaries';
COMMENT ON COLUMN public.cs_client_intel.coach_response IS 'Cached account coach guidance (plain text)';
COMMENT ON COLUMN public.cs_client_intel.coach_generated_at IS 'When coach_response was last generated';
COMMENT ON COLUMN public.cs_client_intel.coach_context_hash IS 'Hash of intel inputs used to invalidate stale coach responses';

-- -----------------------------------------------------------------------------
-- Relationship mapping fields (cs_contacts)
-- -----------------------------------------------------------------------------
ALTER TABLE public.cs_contacts
  ADD COLUMN IF NOT EXISTS contact_role text NOT NULL DEFAULT 'contact'
    CHECK (contact_role IN ('contact', 'decision_maker', 'champion', 'influencer', 'blocker'));

ALTER TABLE public.cs_contacts
  ADD COLUMN IF NOT EXISTS sentiment text NOT NULL DEFAULT 'neutral'
    CHECK (sentiment IN ('positive', 'neutral', 'negative'));

ALTER TABLE public.cs_contacts
  ADD COLUMN IF NOT EXISTS relationship_strength smallint NOT NULL DEFAULT 3
    CHECK (relationship_strength >= 1 AND relationship_strength <= 5);

ALTER TABLE public.cs_contacts
  ADD COLUMN IF NOT EXISTS last_contact_date date;

COMMENT ON COLUMN public.cs_contacts.contact_role IS 'B2B relationship role: champion, influencer, blocker, etc.';
COMMENT ON COLUMN public.cs_contacts.sentiment IS 'Relationship sentiment toward Katana';
COMMENT ON COLUMN public.cs_contacts.relationship_strength IS '1-5 relationship strength score';
COMMENT ON COLUMN public.cs_contacts.last_contact_date IS 'Last touchpoint with this contact';
