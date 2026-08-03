-- =============================================================================
-- Katana Customers: CRM expansion (pipeline, contacts, leads, commerce, campaigns)
-- Run in Supabase SQL Editor after customer-success-schema.sql and org migrations.
-- Extends CS into a hybrid Customer Success + CRM module (B2B and B2C).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extend cs_clients for universal B2B / B2C accounts
-- -----------------------------------------------------------------------------
ALTER TABLE public.cs_clients
  ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'business'
    CHECK (account_type IN ('business', 'individual'));

ALTER TABLE public.cs_clients
  ADD COLUMN IF NOT EXISTS lifecycle_stage text NOT NULL DEFAULT 'customer'
    CHECK (lifecycle_stage IN ('lead', 'prospect', 'customer', 'churned'));

ALTER TABLE public.cs_clients
  ADD COLUMN IF NOT EXISTS email text;

ALTER TABLE public.cs_clients
  ADD COLUMN IF NOT EXISTS phone text;

ALTER TABLE public.cs_clients
  ADD COLUMN IF NOT EXISTS website text;

ALTER TABLE public.cs_clients
  ADD COLUMN IF NOT EXISTS address_line1 text;

ALTER TABLE public.cs_clients
  ADD COLUMN IF NOT EXISTS city text;

ALTER TABLE public.cs_clients
  ADD COLUMN IF NOT EXISTS state text;

ALTER TABLE public.cs_clients
  ADD COLUMN IF NOT EXISTS postal_code text;

ALTER TABLE public.cs_clients
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT '';

ALTER TABLE public.cs_clients
  ADD COLUMN IF NOT EXISTS organization_id uuid;

ALTER TABLE public.cs_clients
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS cs_clients_account_type_idx ON public.cs_clients(account_type);
CREATE INDEX IF NOT EXISTS cs_clients_lifecycle_stage_idx ON public.cs_clients(lifecycle_stage);
CREATE INDEX IF NOT EXISTS cs_clients_organization_id_idx ON public.cs_clients(organization_id);

COMMENT ON COLUMN public.cs_clients.account_type IS 'business = B2B company account; individual = B2C consumer account';
COMMENT ON COLUMN public.cs_clients.lifecycle_stage IS 'CRM lifecycle: lead → prospect → customer → churned';

-- -----------------------------------------------------------------------------
-- cs_contacts — people at B2B accounts (or linked contacts for B2C households)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cs_contacts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id uuid NOT NULL REFERENCES public.cs_clients(id) ON DELETE CASCADE,
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  email text,
  phone text,
  job_title text,
  is_primary boolean NOT NULL DEFAULT false,
  is_decision_maker boolean NOT NULL DEFAULT false,
  notes text,
  user_id uuid REFERENCES auth.users(id),
  organization_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cs_contacts_client_id_idx ON public.cs_contacts(client_id);
CREATE INDEX IF NOT EXISTS cs_contacts_email_idx ON public.cs_contacts(email);

-- -----------------------------------------------------------------------------
-- cs_campaigns — marketing campaigns (inbound lead attribution)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cs_campaigns (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'other'
    CHECK (type IN ('email', 'social', 'event', 'ads', 'referral', 'other')),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  start_date date,
  end_date date,
  budget numeric NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  user_id uuid REFERENCES auth.users(id),
  organization_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cs_campaigns_status_idx ON public.cs_campaigns(status);
CREATE INDEX IF NOT EXISTS cs_campaigns_organization_id_idx ON public.cs_campaigns(organization_id);

-- -----------------------------------------------------------------------------
-- cs_leads — inbound / outbound leads before conversion
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cs_leads (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  email text,
  phone text,
  company_name text,
  account_type text NOT NULL DEFAULT 'business'
    CHECK (account_type IN ('business', 'individual')),
  source text NOT NULL DEFAULT 'other'
    CHECK (source IN ('web', 'referral', 'campaign', 'cold_outreach', 'event', 'phone', 'other')),
  campaign_id uuid REFERENCES public.cs_campaigns(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'qualified', 'unqualified', 'converted')),
  score integer NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  notes text NOT NULL DEFAULT '',
  converted_client_id uuid REFERENCES public.cs_clients(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES public.csm_users(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id),
  organization_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cs_leads_status_idx ON public.cs_leads(status);
CREATE INDEX IF NOT EXISTS cs_leads_campaign_id_idx ON public.cs_leads(campaign_id);
CREATE INDEX IF NOT EXISTS cs_leads_organization_id_idx ON public.cs_leads(organization_id);

-- -----------------------------------------------------------------------------
-- cs_pipeline_stages — configurable deal pipeline
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cs_pipeline_stages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  probability_default integer NOT NULL DEFAULT 0
    CHECK (probability_default >= 0 AND probability_default <= 100),
  is_won boolean NOT NULL DEFAULT false,
  is_lost boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cs_pipeline_stages_org_position_idx
  ON public.cs_pipeline_stages(organization_id, position);

-- -----------------------------------------------------------------------------
-- cs_deals — sales opportunities
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cs_deals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  client_id uuid REFERENCES public.cs_clients(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.cs_contacts(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.cs_leads(id) ON DELETE SET NULL,
  stage_id uuid REFERENCES public.cs_pipeline_stages(id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  probability integer NOT NULL DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
  expected_close_date date,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'won', 'lost')),
  lost_reason text,
  assigned_to uuid REFERENCES public.csm_users(id) ON DELETE SET NULL,
  notes text NOT NULL DEFAULT '',
  user_id uuid REFERENCES auth.users(id),
  organization_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cs_deals_stage_id_idx ON public.cs_deals(stage_id);
CREATE INDEX IF NOT EXISTS cs_deals_client_id_idx ON public.cs_deals(client_id);
CREATE INDEX IF NOT EXISTS cs_deals_status_idx ON public.cs_deals(status);
CREATE INDEX IF NOT EXISTS cs_deals_organization_id_idx ON public.cs_deals(organization_id);

-- -----------------------------------------------------------------------------
-- cs_quotes
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cs_quotes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_number text NOT NULL DEFAULT '',
  deal_id uuid REFERENCES public.cs_deals(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.cs_clients(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.cs_contacts(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  subtotal numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  valid_until date,
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text NOT NULL DEFAULT '',
  user_id uuid REFERENCES auth.users(id),
  organization_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cs_quotes_client_id_idx ON public.cs_quotes(client_id);
CREATE INDEX IF NOT EXISTS cs_quotes_deal_id_idx ON public.cs_quotes(deal_id);

-- -----------------------------------------------------------------------------
-- cs_invoices
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cs_invoices (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number text NOT NULL DEFAULT '',
  quote_id uuid REFERENCES public.cs_quotes(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.cs_clients(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'void')),
  subtotal numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  due_date date,
  paid_date date,
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text NOT NULL DEFAULT '',
  user_id uuid REFERENCES auth.users(id),
  organization_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cs_invoices_client_id_idx ON public.cs_invoices(client_id);
CREATE INDEX IF NOT EXISTS cs_invoices_status_idx ON public.cs_invoices(status);

-- -----------------------------------------------------------------------------
-- cs_contracts
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cs_contracts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  client_id uuid REFERENCES public.cs_clients(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.cs_deals(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'expired', 'terminated')),
  start_date date,
  end_date date,
  value numeric NOT NULL DEFAULT 0,
  terms text NOT NULL DEFAULT '',
  user_id uuid REFERENCES auth.users(id),
  organization_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cs_contracts_client_id_idx ON public.cs_contracts(client_id);

-- -----------------------------------------------------------------------------
-- cs_integration_settings — email / calendar connection state (per org)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cs_integration_settings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL UNIQUE,
  email_provider text CHECK (email_provider IN ('gmail', 'outlook', 'none')),
  email_connected boolean NOT NULL DEFAULT false,
  calendar_provider text CHECK (calendar_provider IN ('google', 'outlook', 'none')),
  calendar_connected boolean NOT NULL DEFAULT false,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- RLS — authenticated users (tighten to org scope in production)
-- -----------------------------------------------------------------------------
ALTER TABLE public.cs_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cs_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cs_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cs_pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cs_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cs_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cs_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cs_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cs_integration_settings ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'cs_contacts', 'cs_campaigns', 'cs_leads', 'cs_pipeline_stages',
    'cs_deals', 'cs_quotes', 'cs_invoices', 'cs_contracts', 'cs_integration_settings'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Allow all on %I" ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "Authenticated only %I" ON public.%I FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)',
      tbl, tbl
    );
  END LOOP;
END $$;
