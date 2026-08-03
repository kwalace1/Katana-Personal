-- =============================================================================
-- Katana Finance Phase 3 — Plaid tokens, vendors (1099), tax packets
-- Run in Supabase Dashboard → SQL Editor (after phase 1 + phase 2)
-- =============================================================================

-- Plaid items (access tokens — server-side only via service role)
CREATE TABLE IF NOT EXISTS public.fin_plaid_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  item_id text NOT NULL,
  access_token text NOT NULL,
  institution_name text,
  institution_id text,
  transactions_cursor text,
  last_synced_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'error', 'disconnected')),
  error_message text,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, item_id)
);

CREATE INDEX IF NOT EXISTS fin_plaid_items_org_idx ON public.fin_plaid_items(organization_id);

ALTER TABLE public.fin_plaid_items ENABLE ROW LEVEL SECURITY;
-- No client policies — service role only

ALTER TABLE public.fin_financial_accounts
  ADD COLUMN IF NOT EXISTS plaid_item_uuid uuid REFERENCES public.fin_plaid_items(id) ON DELETE SET NULL;

ALTER TABLE public.fin_bank_transactions
  ADD COLUMN IF NOT EXISTS plaid_transaction_id text,
  ADD COLUMN IF NOT EXISTS vendor_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS fin_bank_transactions_plaid_txn_unique
  ON public.fin_bank_transactions(organization_id, plaid_transaction_id)
  WHERE plaid_transaction_id IS NOT NULL;

-- 1099 vendor tracking
CREATE TABLE IF NOT EXISTS public.fin_vendors (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  tax_id text,
  address text,
  is_1099_eligible boolean NOT NULL DEFAULT true,
  w9_on_file boolean NOT NULL DEFAULT false,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fin_vendors_org_idx ON public.fin_vendors(organization_id);

ALTER TABLE public.fin_vendors ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'fin_vendors' AND policyname = 'Finance vendors: org select'
  ) THEN
    CREATE POLICY "Finance vendors: org select" ON public.fin_vendors
      FOR SELECT USING (organization_id = public.fin_user_org_id());
    CREATE POLICY "Finance vendors: org insert" ON public.fin_vendors
      FOR INSERT WITH CHECK (organization_id = public.fin_user_org_id());
    CREATE POLICY "Finance vendors: org update" ON public.fin_vendors
      FOR UPDATE USING (organization_id = public.fin_user_org_id());
    CREATE POLICY "Finance vendors: org delete" ON public.fin_vendors
      FOR DELETE USING (organization_id = public.fin_user_org_id());
  END IF;
END $$;

ALTER TABLE public.fin_bank_transactions
  ADD CONSTRAINT fin_bank_transactions_vendor_fk
  FOREIGN KEY (vendor_id) REFERENCES public.fin_vendors(id) ON DELETE SET NULL;

-- Tax packet export log
CREATE TABLE IF NOT EXISTS public.fin_tax_packets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tax_year int NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  entity_type text NOT NULL,
  packet_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fin_tax_packets_org_year_idx
  ON public.fin_tax_packets(organization_id, tax_year DESC);

ALTER TABLE public.fin_tax_packets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'fin_tax_packets' AND policyname = 'Finance tax packets: org select'
  ) THEN
    CREATE POLICY "Finance tax packets: org select" ON public.fin_tax_packets
      FOR SELECT USING (organization_id = public.fin_user_org_id());
    CREATE POLICY "Finance tax packets: org insert" ON public.fin_tax_packets
      FOR INSERT WITH CHECK (organization_id = public.fin_user_org_id());
  END IF;
END $$;
