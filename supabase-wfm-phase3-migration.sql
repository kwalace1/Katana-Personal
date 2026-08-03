-- =============================================================================
-- Katana Workforce Phase 3 — cross-module links (Projects, Finance, Inventory)
-- Run after supabase-wfm-phase2-migration.sql
-- =============================================================================

-- Link work items to PM projects/tasks and drafted CRM invoices
ALTER TABLE public.wfm_jobs
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.cs_invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS wfm_jobs_project_id_idx ON public.wfm_jobs(project_id);
CREATE INDEX IF NOT EXISTS wfm_jobs_task_id_idx ON public.wfm_jobs(task_id);
CREATE INDEX IF NOT EXISTS wfm_jobs_invoice_id_idx ON public.wfm_jobs(invoice_id);

-- Parts planned or consumed on a work item (inventory check-out on completion)
CREATE TABLE IF NOT EXISTS public.wfm_job_parts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id uuid NOT NULL REFERENCES public.wfm_jobs(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  quantity numeric NOT NULL DEFAULT 1 CHECK (quantity > 0),
  checked_out boolean NOT NULL DEFAULT false,
  notes text,
  user_id uuid REFERENCES auth.users(id),
  organization_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wfm_job_parts_job_id_idx ON public.wfm_job_parts(job_id);
CREATE INDEX IF NOT EXISTS wfm_job_parts_item_id_idx ON public.wfm_job_parts(item_id);

ALTER TABLE public.wfm_job_parts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated wfm_job_parts" ON public.wfm_job_parts;
CREATE POLICY "Authenticated wfm_job_parts"
  ON public.wfm_job_parts FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

COMMENT ON TABLE public.wfm_job_parts IS
  'Inventory parts associated with a workforce job; checked out when job completes';
