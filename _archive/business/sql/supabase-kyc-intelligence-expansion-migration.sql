-- =============================================================================
-- Katana KYC — intelligence expansion (trends, revenue metrics, modules)
-- Run after supabase-kyc-summary-migration.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Usage snapshots — portal, engagement, support trends over time
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cs_client_usage_snapshots (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id uuid NOT NULL REFERENCES public.cs_clients(id) ON DELETE CASCADE,
  organization_id uuid,
  portal_logins integer NOT NULL DEFAULT 0,
  engagement_score integer NOT NULL DEFAULT 0 CHECK (engagement_score >= 0 AND engagement_score <= 100),
  feature_usage text NOT NULL DEFAULT 'low',
  support_tickets integer NOT NULL DEFAULT 0,
  active_users integer NOT NULL DEFAULT 0,
  meetings_30d integer NOT NULL DEFAULT 0,
  emails_30d integer NOT NULL DEFAULT 0,
  health_score integer CHECK (health_score >= 0 AND health_score <= 100),
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cs_client_usage_snapshots_client_idx
  ON public.cs_client_usage_snapshots(client_id, recorded_at DESC);

-- -----------------------------------------------------------------------------
-- MRR / ARR snapshots — GRR, NRR, logo retention
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cs_mrr_snapshots (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id uuid NOT NULL REFERENCES public.cs_clients(id) ON DELETE CASCADE,
  organization_id uuid,
  snapshot_month date NOT NULL,
  mrr numeric NOT NULL DEFAULT 0,
  arr numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, snapshot_month)
);

CREATE INDEX IF NOT EXISTS cs_mrr_snapshots_org_month_idx
  ON public.cs_mrr_snapshots(organization_id, snapshot_month DESC);

-- -----------------------------------------------------------------------------
-- Support ticket events — activity timeline + risk signals
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cs_support_ticket_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id uuid NOT NULL REFERENCES public.cs_clients(id) ON DELETE CASCADE,
  organization_id uuid,
  subject text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'resolved', 'escalated')),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cs_support_ticket_events_client_idx
  ON public.cs_support_ticket_events(client_id, opened_at DESC);

-- -----------------------------------------------------------------------------
-- Katana product module catalog — expansion value estimates
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cs_katana_product_modules (
  id text PRIMARY KEY,
  label text NOT NULL,
  monthly_price numeric NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT ''
);

INSERT INTO public.cs_katana_product_modules (id, label, monthly_price, description)
VALUES
  ('customers', 'Customer Success (CRM)', 0, 'Core CRM — included with platform'),
  ('wfm', 'Workforce Management', 299, 'Field service scheduling and dispatch'),
  ('portal', 'Employee Portal', 99, 'Self-service employee portal'),
  ('projects', 'Project Management', 199, 'Projects, tasks, and milestones'),
  ('hr', 'HR & People', 249, 'HR records, reviews, and goals'),
  ('inventory', 'Inventory', 179, 'Stock, POs, and suppliers')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Client module entitlements — purchased vs available modules
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cs_client_module_entitlements (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id uuid NOT NULL REFERENCES public.cs_clients(id) ON DELETE CASCADE,
  organization_id uuid,
  module_id text NOT NULL REFERENCES public.cs_katana_product_modules(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'trial', 'churned')),
  purchased_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, module_id)
);

CREATE INDEX IF NOT EXISTS cs_client_module_entitlements_client_idx
  ON public.cs_client_module_entitlements(client_id);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.cs_client_usage_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cs_mrr_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cs_support_ticket_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cs_katana_product_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cs_client_module_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated cs_client_usage_snapshots" ON public.cs_client_usage_snapshots;
CREATE POLICY "Authenticated cs_client_usage_snapshots"
  ON public.cs_client_usage_snapshots FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated cs_mrr_snapshots" ON public.cs_mrr_snapshots;
CREATE POLICY "Authenticated cs_mrr_snapshots"
  ON public.cs_mrr_snapshots FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated cs_support_ticket_events" ON public.cs_support_ticket_events;
CREATE POLICY "Authenticated cs_support_ticket_events"
  ON public.cs_support_ticket_events FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated cs_katana_product_modules" ON public.cs_katana_product_modules;
CREATE POLICY "Authenticated cs_katana_product_modules"
  ON public.cs_katana_product_modules FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated cs_client_module_entitlements" ON public.cs_client_module_entitlements;
CREATE POLICY "Authenticated cs_client_module_entitlements"
  ON public.cs_client_module_entitlements FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
