-- =============================================================================
-- Katana KYC — link CS tasks to intelligence recommended actions
-- Run in Supabase SQL editor after customer-success schema is in place.
-- =============================================================================

ALTER TABLE public.cs_tasks
  ADD COLUMN IF NOT EXISTS kyc_action_id text;

CREATE INDEX IF NOT EXISTS cs_tasks_kyc_action_id_idx
  ON public.cs_tasks(client_id, kyc_action_id)
  WHERE kyc_action_id IS NOT NULL;

COMMENT ON COLUMN public.cs_tasks.kyc_action_id IS
  'KYC recommended action id (e.g. renewal-urgent, executive-meeting). Used to suppress repeat recommendations and clear risk signals when completed.';
