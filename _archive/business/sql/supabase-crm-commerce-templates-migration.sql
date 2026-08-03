-- =============================================================================
-- CRM Commerce Templates — customizable quote, invoice, and contract templates
-- Run in Supabase Dashboard → SQL Editor
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.cs_commerce_templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL,
  doc_type text NOT NULL CHECK (doc_type IN ('quote', 'invoice', 'contract')),
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cs_commerce_templates_org_type_idx
  ON public.cs_commerce_templates(organization_id, doc_type);

CREATE UNIQUE INDEX IF NOT EXISTS cs_commerce_templates_one_default_per_type
  ON public.cs_commerce_templates(organization_id, doc_type)
  WHERE is_default = true;

-- Per-document customization overrides
ALTER TABLE public.cs_quotes
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.cs_commerce_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS document_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.cs_invoices
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.cs_commerce_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS document_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.cs_contracts
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.cs_commerce_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS document_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.cs_commerce_templates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'cs_commerce_templates' AND policyname = 'Allow all on cs_commerce_templates'
  ) THEN
    CREATE POLICY "Allow all on cs_commerce_templates"
      ON public.cs_commerce_templates FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
