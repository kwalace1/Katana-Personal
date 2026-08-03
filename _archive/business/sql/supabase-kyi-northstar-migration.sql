-- =============================================================================
-- KYI Investor Northstar — Katana Business Solutions fundraise tracker
-- Run after supabase-kyi-schema.sql and supabase-kyi-refinement-migration.sql
-- Idempotent: safe to re-run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Investor type profiles (reference data for 9 Northstar categories)
-- Table may already exist from legacy KYI — add Northstar columns if missing.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kyi_investor_type_profiles (
  id          serial PRIMARY KEY,
  type        text NOT NULL,
  description text,
  motivations text,
  cares_about text,
  decision_drivers text,
  red_flags   text,
  messaging_approach text,
  outreach_angle text
);

ALTER TABLE public.kyi_investor_type_profiles
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS category_fields jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Ensure type is unique for upsert (legacy tables may lack this)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.kyi_investor_type_profiles'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) LIKE '%type%'
  ) THEN
    ALTER TABLE public.kyi_investor_type_profiles
      ADD CONSTRAINT kyi_investor_type_profiles_type_unique UNIQUE (type);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN unique_violation THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS kyi_investor_type_profiles_slug_unique_idx
  ON public.kyi_investor_type_profiles(slug)
  WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS kyi_investor_type_profiles_slug_idx
  ON public.kyi_investor_type_profiles(slug);

-- -----------------------------------------------------------------------------
-- Per-company Northstar strategy config
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kyi_northstar_config (
  company_id           integer PRIMARY KEY REFERENCES public.kyi_companies(id) ON DELETE CASCADE,
  strategy_priorities  jsonb NOT NULL DEFAULT '[]'::jsonb,
  ideal_profile_traits jsonb NOT NULL DEFAULT '[]'::jsonb,
  strategy_notes       text,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Northstar fields on investors (pipeline, scorecard, tier, diligence)
-- -----------------------------------------------------------------------------
ALTER TABLE public.kyi_investors
  ADD COLUMN IF NOT EXISTS northstar_tier integer
    CHECK (northstar_tier IS NULL OR northstar_tier IN (1, 2, 3)),
  ADD COLUMN IF NOT EXISTS northstar_pipeline_stage text
    CHECK (northstar_pipeline_stage IS NULL OR northstar_pipeline_stage IN (
      'research', 'intro_requested', 'first_meeting', 'partner_meeting',
      'due_diligence', 'term_sheet', 'closed', 'passed'
    )),
  ADD COLUMN IF NOT EXISTS northstar_probability integer
    CHECK (northstar_probability IS NULL OR (northstar_probability >= 0 AND northstar_probability <= 100)),
  ADD COLUMN IF NOT EXISTS northstar_warm_intro boolean,
  ADD COLUMN IF NOT EXISTS northstar_last_contact_at timestamptz,
  ADD COLUMN IF NOT EXISTS northstar_next_step text,
  ADD COLUMN IF NOT EXISTS northstar_scorecard jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS northstar_category_fields jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS northstar_due_diligence jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS kyi_investors_northstar_pipeline_idx
  ON public.kyi_investors(company_id, northstar_pipeline_stage)
  WHERE northstar_pipeline_stage IS NOT NULL;

CREATE INDEX IF NOT EXISTS kyi_investors_northstar_tier_idx
  ON public.kyi_investors(company_id, northstar_tier)
  WHERE northstar_tier IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Structured meeting notes (Northstar template)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kyi_investor_meetings (
  id                       serial PRIMARY KEY,
  investor_id              integer NOT NULL REFERENCES public.kyi_investors(id) ON DELETE CASCADE,
  company_id               integer NOT NULL REFERENCES public.kyi_companies(id) ON DELETE CASCADE,
  meeting_date             date,
  attendees                text,
  key_discussion_points    text,
  questions_asked          text,
  concerns_raised          text,
  follow_up_items          text,
  overall_impression       text,
  likelihood_of_investment text,
  next_meeting_date        date,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kyi_investor_meetings_investor_idx
  ON public.kyi_investor_meetings(investor_id, meeting_date DESC);

CREATE INDEX IF NOT EXISTS kyi_investor_meetings_company_idx
  ON public.kyi_investor_meetings(company_id, meeting_date DESC);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.kyi_investor_type_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyi_northstar_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyi_investor_meetings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'kyi_investor_type_profiles'
      AND policyname = 'authenticated_kyi_type_profiles'
  ) THEN
    CREATE POLICY authenticated_kyi_type_profiles ON public.kyi_investor_type_profiles
      FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'kyi_northstar_config'
      AND policyname = 'user_isolation_kyi_northstar_config'
  ) THEN
    CREATE POLICY user_isolation_kyi_northstar_config ON public.kyi_northstar_config
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.kyi_companies c
          WHERE c.id = kyi_northstar_config.company_id AND c.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.kyi_companies c
          WHERE c.id = kyi_northstar_config.company_id AND c.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'kyi_investor_meetings'
      AND policyname = 'user_isolation_kyi_investor_meetings'
  ) THEN
    CREATE POLICY user_isolation_kyi_investor_meetings ON public.kyi_investor_meetings
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.kyi_companies c
          WHERE c.id = kyi_investor_meetings.company_id AND c.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.kyi_companies c
          WHERE c.id = kyi_investor_meetings.company_id AND c.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Seed: 9 investor categories from Northstar doc
-- Upsert by type OR slug — safe when legacy rows already occupy id 1..N.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  seq_name text;
BEGIN
  seq_name := pg_get_serial_sequence('public.kyi_investor_type_profiles', 'id');
  IF seq_name IS NOT NULL THEN
    PERFORM setval(
      seq_name,
      (SELECT COALESCE(MAX(id), 1) FROM public.kyi_investor_type_profiles),
      true
    );
  END IF;
END $$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      (
        'SaaS / B2B Software Investors'::text,
        'saas_b2b_software'::text,
        'Investors with deep experience scaling subscription software companies.'::text,
        'SaaS growth expertise, pricing strategy, product-led growth, enterprise sales, ARR optimization, future fundraising support.'::text,
        'Typical check $20k–$5M. Ideal stage: Seed, Pre-Seed, Series A.'::text,
        1::integer,
        '["partner","website","investment_stage","average_check","portfolio_companies","why_fit","warm_intro_available","current_status","next_action","meeting_notes"]'::jsonb
      ),
      (
        'Vertical SaaS Investors',
        'vertical_saas',
        'Funds that specialize in software for specific industries.',
        'Understand operational software, service businesses, strong industry connections, customer introductions.',
        'Example industries: Home Services, Healthcare, Construction, Professional Services, Manufacturing.',
        2,
        '["partner","website","industries_invested_in","average_check","portfolio_companies","strategic_value","current_status","notes"]'::jsonb
      ),
      (
        'AI & Automation Investors',
        'ai_automation',
        'Investors focused on AI-enabled business software.',
        'AI positioning, technical hiring, infrastructure guidance, competitive intelligence.',
        NULL::text,
        3,
        '["partner","website","ai_focus","average_check","portfolio","strategic_benefit","current_status","notes"]'::jsonb
      ),
      (
        'FinTech Investors',
        'fintech',
        'Investors experienced in financial software and embedded finance.',
        'Especially valuable for payments, payroll, banking integrations, lending, financial reporting.',
        NULL::text,
        4,
        '["partner","website","portfolio","why_relevant","current_status","notes"]'::jsonb
      ),
      (
        'Private Equity Growth Investors',
        'pe_growth',
        'Growth-focused investors looking for scalable businesses.',
        'Scaling operations, executive hiring, M&A experience, expansion strategy. Typically later-stage.',
        NULL::text,
        5,
        '["partner","website","investment_criteria","average_check","current_status","notes"]'::jsonb
      ),
      (
        'Family Offices',
        'family_office',
        'Long-term investors with patient capital.',
        'Flexible structures, less bureaucracy, long investment horizon, often founder-friendly.',
        NULL::text,
        6,
        '["primary_contact","industry_background","investment_focus","average_investment","warm_intro","current_status","notes"]'::jsonb
      ),
      (
        'Founder Operators / Angel Investors',
        'founder_operator_angel',
        'Successful founders investing personally.',
        'Mentorship, hiring advice, customer introductions, product feedback, credibility.',
        'Ideal backgrounds: CRM, SaaS, workflow software, AI, home service technology.',
        7,
        '["previous_company","exit","current_company","investment_size","strategic_value","current_status","notes"]'::jsonb
      ),
      (
        'Industry Strategic Investors',
        'industry_strategic',
        'Companies investing for strategic partnerships.',
        'Distribution, channel partnerships, enterprise customers, integration opportunities.',
        'Examples: payroll providers, scheduling platforms, accounting software, CRM vendors.',
        8,
        '["corporate_venture_arm","contact","strategic_benefit","potential_partnership","current_status","notes"]'::jsonb
      ),
      (
        'Customer Investors',
        'customer_investor',
        'Successful customers investing in the platform they use.',
        'Highest product conviction, immediate testimonials, industry credibility, real-world feedback.',
        NULL::text,
        9,
        '["owner","industry","current_customer","investment_interest","strategic_value","notes"]'::jsonb
      )
    ) AS v(type, slug, description, motivations, cares_about, sort_order, category_fields)
  LOOP
    UPDATE public.kyi_investor_type_profiles
    SET
      type = r.type,
      slug = r.slug,
      description = r.description,
      motivations = r.motivations,
      cares_about = r.cares_about,
      sort_order = r.sort_order,
      category_fields = r.category_fields
    WHERE type = r.type
       OR slug = r.slug;

    IF NOT FOUND THEN
      INSERT INTO public.kyi_investor_type_profiles (
        type, slug, description, motivations, cares_about, sort_order, category_fields
      ) VALUES (
        r.type, r.slug, r.description, r.motivations, r.cares_about, r.sort_order, r.category_fields
      );
    END IF;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- Seed: Katana Business Solutions company + Northstar strategy defaults
-- Only when a Katana/platform organization exists (requires organization_id).
-- -----------------------------------------------------------------------------
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
    raise notice 'kyi-northstar seed: no Katana/platform organization found; skipping company seed';
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
    'Katana Business Solutions — internal investor target database & outreach tracker (Northstar).',
    platform_org,
    now()
  )
  on conflict (id) do update set
    name = excluded.name,
    location = excluded.location,
    industry = excluded.industry,
    website = excluded.website,
    description = excluded.description,
    organization_id = excluded.organization_id;

  insert into public.kyi_northstar_config (company_id, strategy_priorities, ideal_profile_traits, strategy_notes)
  values (
    1,
    '[
      "Strategic value",
      "Industry expertise",
      "Customer introductions",
      "Ability to lead future funding rounds",
      "Capital"
    ]'::jsonb,
    '[
      "Understands B2B SaaS economics",
      "Believes in AI-powered workflow software",
      "Has experience with SMB software",
      "Makes customer introductions",
      "Assists with executive recruiting",
      "Supports future fundraising rounds",
      "Has a long-term investment horizon",
      "Is founder-friendly",
      "Willing to actively advise the company",
      "Adds significantly more value than capital alone"
    ]'::jsonb,
    'Money alone should never be the deciding factor. Prioritize investors that provide strategic guidance, customer introductions, industry expertise, hiring support, and long-term credibility.'
  )
  on conflict (company_id) do update set
    strategy_priorities = excluded.strategy_priorities,
    ideal_profile_traits = excluded.ideal_profile_traits,
    strategy_notes = excluded.strategy_notes,
    updated_at = now();
end $$;
