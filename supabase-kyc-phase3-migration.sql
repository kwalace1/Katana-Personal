-- =============================================================================
-- Katana KYC Phase 3 — external enrichment storage
-- Run after supabase-kyc-phase2-migration.sql
-- =============================================================================

ALTER TABLE public.cs_clients
  ADD COLUMN IF NOT EXISTS external_signals jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.cs_clients
  ADD COLUMN IF NOT EXISTS external_enrichment jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.cs_clients
  ADD COLUMN IF NOT EXISTS last_external_refresh_at timestamptz;

CREATE INDEX IF NOT EXISTS cs_clients_external_signals_gin_idx
  ON public.cs_clients USING gin (external_signals);

COMMENT ON COLUMN public.cs_clients.external_signals IS 'KYC external enrichment flags (registry, news, funding, etc.)';
COMMENT ON COLUMN public.cs_clients.external_enrichment IS 'Raw enrichment payload (registry match, news articles)';

-- -----------------------------------------------------------------------------
-- Enrichment audit log (optional — batch + manual refresh history)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cs_kyc_enrichment_log (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id uuid NOT NULL REFERENCES public.cs_clients(id) ON DELETE CASCADE,
  organization_id uuid,
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'batch', 'api')),
  status text NOT NULL DEFAULT 'success'
    CHECK (status IN ('success', 'partial', 'failed')),
  signal_count integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cs_kyc_enrichment_log_client_idx
  ON public.cs_kyc_enrichment_log(client_id, created_at DESC);

ALTER TABLE public.cs_kyc_enrichment_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated cs_kyc_enrichment_log" ON public.cs_kyc_enrichment_log;
CREATE POLICY "Authenticated cs_kyc_enrichment_log"
  ON public.cs_kyc_enrichment_log FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
