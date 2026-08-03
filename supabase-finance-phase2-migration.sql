-- =============================================================================
-- Katana Finance Phase 2 — statement import, reconciliation, cross-module links
-- Run in Supabase Dashboard → SQL Editor (after supabase-finance-schema.sql)
-- =============================================================================

-- Cross-module link on bank transactions (invoice, purchase order)
ALTER TABLE public.fin_bank_transactions
  ADD COLUMN IF NOT EXISTS linked_source_type text CHECK (
    linked_source_type IS NULL OR linked_source_type IN ('invoice', 'purchase_order')
  ),
  ADD COLUMN IF NOT EXISTS linked_source_id uuid,
  ADD COLUMN IF NOT EXISTS reconciliation_id uuid REFERENCES public.fin_reconciliations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS fin_bank_transactions_recon_idx
  ON public.fin_bank_transactions(reconciliation_id);

CREATE INDEX IF NOT EXISTS fin_bank_transactions_linked_idx
  ON public.fin_bank_transactions(linked_source_type, linked_source_id);

-- Items cleared during a reconciliation session
CREATE TABLE IF NOT EXISTS public.fin_reconciliation_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reconciliation_id uuid NOT NULL REFERENCES public.fin_reconciliations(id) ON DELETE CASCADE,
  bank_transaction_id uuid NOT NULL REFERENCES public.fin_bank_transactions(id) ON DELETE CASCADE,
  is_cleared boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reconciliation_id, bank_transaction_id)
);

CREATE INDEX IF NOT EXISTS fin_reconciliation_items_recon_idx
  ON public.fin_reconciliation_items(reconciliation_id);

ALTER TABLE public.fin_reconciliation_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'fin_reconciliation_items' AND policyname = 'Finance: org select'
  ) THEN
    CREATE POLICY "Finance: org select" ON public.fin_reconciliation_items
      FOR SELECT USING (organization_id = public.fin_user_org_id());
    CREATE POLICY "Finance: org insert" ON public.fin_reconciliation_items
      FOR INSERT WITH CHECK (organization_id = public.fin_user_org_id());
    CREATE POLICY "Finance: org update" ON public.fin_reconciliation_items
      FOR UPDATE USING (organization_id = public.fin_user_org_id());
    CREATE POLICY "Finance: org delete" ON public.fin_reconciliation_items
      FOR DELETE USING (organization_id = public.fin_user_org_id());
  END IF;
END $$;

-- Statement file storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'finance-statements',
  'finance-statements',
  false,
  10485760,
  ARRAY['text/csv', 'application/pdf', 'text/plain', 'application/vnd.ms-excel']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "finance_statements_insert" ON storage.objects;
CREATE POLICY "finance_statements_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'finance-statements');

DROP POLICY IF EXISTS "finance_statements_select" ON storage.objects;
CREATE POLICY "finance_statements_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'finance-statements');

DROP POLICY IF EXISTS "finance_statements_delete" ON storage.objects;
CREATE POLICY "finance_statements_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'finance-statements');
