-- =============================================================================
-- KYI per-company customization — investor categories & Northstar framework
-- Run after supabase-kyi-northstar-migration.sql
-- Idempotent: safe to re-run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Per-company investor categories (forked from global templates)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kyi_company_investor_categories (
  id                  serial PRIMARY KEY,
  company_id          integer NOT NULL REFERENCES public.kyi_companies(id) ON DELETE CASCADE,
  type                text NOT NULL,
  slug                text,
  description         text,
  motivations         text,
  cares_about         text,
  decision_drivers    text,
  red_flags           text,
  messaging_approach  text,
  outreach_angle      text,
  category_fields     jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order          integer NOT NULL DEFAULT 0,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kyi_company_investor_categories_company_type_unique UNIQUE (company_id, type)
);

CREATE INDEX IF NOT EXISTS kyi_company_investor_categories_company_idx
  ON public.kyi_company_investor_categories(company_id, sort_order)
  WHERE is_active = true;

-- -----------------------------------------------------------------------------
-- Extend Northstar config with customizable framework fields
-- -----------------------------------------------------------------------------
ALTER TABLE public.kyi_northstar_config
  ADD COLUMN IF NOT EXISTS pipeline_stages jsonb,
  ADD COLUMN IF NOT EXISTS scorecard_criteria jsonb,
  ADD COLUMN IF NOT EXISTS due_diligence_questions jsonb,
  ADD COLUMN IF NOT EXISTS tiers jsonb;

-- Allow custom pipeline stages (drop fixed enum CHECK if present)
DO $$
DECLARE
  cname text;
BEGIN
  FOR cname IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'kyi_investors'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%northstar_pipeline_stage%'
  LOOP
    EXECUTE format('ALTER TABLE public.kyi_investors DROP CONSTRAINT IF EXISTS %I', cname);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- RLS — company-scoped categories
-- -----------------------------------------------------------------------------
ALTER TABLE public.kyi_company_investor_categories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'kyi_company_investor_categories'
      AND policyname = 'user_isolation_kyi_company_investor_categories'
  ) THEN
    CREATE POLICY user_isolation_kyi_company_investor_categories
      ON public.kyi_company_investor_categories
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.kyi_companies c
          WHERE c.id = kyi_company_investor_categories.company_id
            AND c.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.kyi_companies c
          WHERE c.id = kyi_company_investor_categories.company_id
            AND c.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Seed company categories + framework for existing companies (from global defaults)
-- -----------------------------------------------------------------------------
INSERT INTO public.kyi_company_investor_categories (
  company_id, type, slug, description, motivations, cares_about,
  decision_drivers, red_flags, messaging_approach, outreach_angle,
  category_fields, sort_order, is_active
)
SELECT
  c.id,
  p.type,
  p.slug,
  p.description,
  p.motivations,
  p.cares_about,
  p.decision_drivers,
  p.red_flags,
  p.messaging_approach,
  p.outreach_angle,
  COALESCE(p.category_fields, '[]'::jsonb),
  COALESCE(p.sort_order, 0),
  true
FROM public.kyi_companies c
CROSS JOIN public.kyi_investor_type_profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.kyi_company_investor_categories cc
  WHERE cc.company_id = c.id
);

UPDATE public.kyi_northstar_config nc
SET
  pipeline_stages = COALESCE(nc.pipeline_stages, '[
    {"value":"research","label":"Research"},
    {"value":"intro_requested","label":"Intro Requested"},
    {"value":"first_meeting","label":"First Meeting"},
    {"value":"partner_meeting","label":"Partner Meeting"},
    {"value":"due_diligence","label":"Due Diligence"},
    {"value":"term_sheet","label":"Term Sheet"},
    {"value":"closed","label":"Closed"},
    {"value":"passed","label":"Passed"}
  ]'::jsonb),
  scorecard_criteria = COALESCE(nc.scorecard_criteria, '[
    {"key":"understands_saas","label":"Understands SaaS"},
    {"key":"understands_ai","label":"Understands AI"},
    {"key":"understands_smb_software","label":"Understands SMB Software"},
    {"key":"can_introduce_customers","label":"Can Introduce Customers"},
    {"key":"can_help_recruit_talent","label":"Can Help Recruit Talent"},
    {"key":"has_follow_on_capital","label":"Has Follow-on Capital"},
    {"key":"strong_reputation","label":"Strong Reputation"},
    {"key":"responsive","label":"Responsive"},
    {"key":"long_term_partner","label":"Long-Term Partner"},
    {"key":"founder_friendly","label":"Founder Friendly"}
  ]'::jsonb),
  due_diligence_questions = COALESCE(nc.due_diligence_questions, '[
    {"key":"portfolio_companies","label":"What companies have they invested in?"},
    {"key":"ownership_target","label":"What is their average ownership target?"},
    {"key":"leads_rounds","label":"Do they lead rounds?"},
    {"key":"competitor_investments","label":"Have they invested in competitors?"},
    {"key":"post_investment_involvement","label":"How involved are they after investing?"},
    {"key":"decision_speed","label":"How quickly do they make decisions?"},
    {"key":"enterprise_intros","label":"Can they introduce enterprise customers?"},
    {"key":"executive_recruiting","label":"Can they help recruit executives?"},
    {"key":"founder_sentiment","label":"Have founders spoken positively about them?"},
    {"key":"company_strength","label":"Why would this investor specifically make us stronger?"}
  ]'::jsonb),
  tiers = COALESCE(nc.tiers, '[
    {"value":1,"label":"Tier 1 — Pursue Immediately","description":"Highest strategic value investors."},
    {"value":2,"label":"Tier 2 — Strong Fits","description":"Excellent investors if Tier 1 is unavailable."},
    {"value":3,"label":"Tier 3 — Capital Only","description":"Good financial partners but limited strategic value."}
  ]'::jsonb)
WHERE nc.pipeline_stages IS NULL
   OR nc.scorecard_criteria IS NULL
   OR nc.due_diligence_questions IS NULL
   OR nc.tiers IS NULL;
