-- =============================================================================
-- Katana Customers — Know Your Customer (KYC) intelligence layer
-- Run after supabase-crm-migration.sql and supabase-crm-phase2-migration.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Signal + outreach columns on accounts and leads
-- -----------------------------------------------------------------------------
ALTER TABLE public.cs_clients
  ADD COLUMN IF NOT EXISTS signals jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.cs_clients
  ADD COLUMN IF NOT EXISTS outreach_status text NOT NULL DEFAULT 'none'
    CHECK (outreach_status IN ('none', 'planned', 'contacted', 'meeting', 'completed', 'at_risk'));

ALTER TABLE public.cs_clients
  ADD COLUMN IF NOT EXISTS last_signal_refresh_at timestamptz;

ALTER TABLE public.cs_leads
  ADD COLUMN IF NOT EXISTS signals jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.cs_leads
  ADD COLUMN IF NOT EXISTS outreach_status text NOT NULL DEFAULT 'new'
    CHECK (outreach_status IN ('new', 'contacted', 'meeting', 'qualified', 'passed'));

CREATE INDEX IF NOT EXISTS cs_clients_signals_gin_idx ON public.cs_clients USING gin (signals);
CREATE INDEX IF NOT EXISTS cs_clients_outreach_status_idx ON public.cs_clients(outreach_status);
CREATE INDEX IF NOT EXISTS cs_leads_signals_gin_idx ON public.cs_leads USING gin (signals);

COMMENT ON COLUMN public.cs_clients.signals IS 'Computed KYC signal flags (support, renewal, engagement, contacts, etc.)';
COMMENT ON COLUMN public.cs_clients.outreach_status IS 'Renewal/expansion play outreach stage';

-- -----------------------------------------------------------------------------
-- cs_icp_profiles — org ideal customer profile (KYI raise-context equivalent)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cs_icp_profiles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL UNIQUE,
  target_industries text[] NOT NULL DEFAULT '{}',
  target_states text[] NOT NULL DEFAULT '{}',
  target_countries text[] NOT NULL DEFAULT '{}',
  preferred_account_types text[] NOT NULL DEFAULT ARRAY['business']::text[],
  min_deal_size numeric NOT NULL DEFAULT 0,
  sector_tags text[] NOT NULL DEFAULT '{}',
  description text NOT NULL DEFAULT '',
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cs_icp_profiles_org_idx ON public.cs_icp_profiles(organization_id);

-- -----------------------------------------------------------------------------
-- cs_client_intel — CSM notes and messaging angles (KYI lead profile intel)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cs_client_intel (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id uuid NOT NULL UNIQUE REFERENCES public.cs_clients(id) ON DELETE CASCADE,
  motivations text,
  decision_drivers text[] NOT NULL DEFAULT '{}',
  red_flags text[] NOT NULL DEFAULT '{}',
  green_flags text[] NOT NULL DEFAULT '{}',
  ideal_messaging_approach text,
  notes_next_steps text,
  user_id uuid REFERENCES auth.users(id),
  organization_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cs_client_intel_client_id_idx ON public.cs_client_intel(client_id);
CREATE INDEX IF NOT EXISTS cs_client_intel_org_idx ON public.cs_client_intel(organization_id);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.cs_icp_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cs_client_intel ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated cs_icp_profiles" ON public.cs_icp_profiles;
CREATE POLICY "Authenticated cs_icp_profiles"
  ON public.cs_icp_profiles FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated cs_client_intel" ON public.cs_client_intel;
CREATE POLICY "Authenticated cs_client_intel"
  ON public.cs_client_intel FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
