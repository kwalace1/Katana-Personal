-- =============================================================================
-- Katana CRM Phase 2 — public leads, workflows, cross-module links, OAuth tokens
-- Run after supabase-crm-migration.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Link workforce jobs and support tickets to customer accounts
-- -----------------------------------------------------------------------------
ALTER TABLE public.wfm_jobs
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.cs_clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS wfm_jobs_client_id_idx ON public.wfm_jobs(client_id);

ALTER TABLE public.support_submissions
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.cs_clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS support_submissions_client_id_idx ON public.support_submissions(client_id);

-- -----------------------------------------------------------------------------
-- CRM workflow rules (org-scoped automation)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cs_crm_workflows (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  trigger_event text NOT NULL
    CHECK (trigger_event IN ('deal_won', 'deal_lost', 'lead_created', 'lead_converted')),
  enabled boolean NOT NULL DEFAULT true,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cs_crm_workflows_org_trigger_idx
  ON public.cs_crm_workflows(organization_id, trigger_event);

ALTER TABLE public.cs_crm_workflows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated cs_crm_workflows" ON public.cs_crm_workflows;
CREATE POLICY "Authenticated cs_crm_workflows"
  ON public.cs_crm_workflows FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- -----------------------------------------------------------------------------
-- Public org lookup (name only — for lead capture landing pages)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_org_by_slug(p_slug text)
RETURNS TABLE(id uuid, name text, slug text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.name, o.slug
  FROM public.organizations o
  WHERE o.slug = lower(trim(p_slug))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_org_by_slug(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_org_by_slug(text) TO authenticated;

-- -----------------------------------------------------------------------------
-- Public inbound lead submission (anon-safe via SECURITY DEFINER)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_public_crm_lead(
  p_org_slug text,
  p_first_name text,
  p_last_name text DEFAULT '',
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_company_name text DEFAULT NULL,
  p_account_type text DEFAULT 'business',
  p_message text DEFAULT '',
  p_campaign_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_owner_id uuid;
  v_lead_id uuid;
  v_account_type text;
BEGIN
  IF coalesce(trim(p_org_slug), '') = '' THEN
    RAISE EXCEPTION 'Organization slug is required';
  END IF;

  SELECT o.id INTO v_org_id
  FROM public.organizations o
  WHERE o.slug = lower(trim(p_org_slug))
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;

  v_account_type := CASE
    WHEN lower(trim(coalesce(p_account_type, ''))) = 'individual' THEN 'individual'
    ELSE 'business'
  END;

  SELECT up.id INTO v_owner_id
  FROM public.user_profiles up
  WHERE up.organization_id = v_org_id
    AND up.role IN ('owner', 'admin')
  ORDER BY CASE up.role WHEN 'owner' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    SELECT up.id INTO v_owner_id
    FROM public.user_profiles up
    WHERE up.organization_id = v_org_id
    LIMIT 1;
  END IF;

  INSERT INTO public.cs_leads (
    first_name,
    last_name,
    email,
    phone,
    company_name,
    account_type,
    source,
    campaign_id,
    status,
    score,
    notes,
    assigned_to,
    user_id,
    organization_id
  ) VALUES (
    coalesce(trim(p_first_name), ''),
    coalesce(trim(p_last_name), ''),
    nullif(trim(coalesce(p_email, '')), ''),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_company_name, '')), ''),
    v_account_type,
    'web',
    p_campaign_id,
    'new',
    50,
    coalesce(trim(p_message), ''),
    NULL,
    v_owner_id,
    v_org_id
  )
  RETURNING id INTO v_lead_id;

  RETURN v_lead_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_public_crm_lead(text, text, text, text, text, text, text, text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_public_crm_lead(text, text, text, text, text, text, text, text, uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- Sync support ticket count on cs_clients when submissions are linked
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_cs_client_support_ticket_count(p_client_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_client_id IS NULL THEN RETURN; END IF;
  UPDATE public.cs_clients c
  SET support_tickets = (
    SELECT count(*)::integer
    FROM public.support_submissions s
    WHERE s.client_id = p_client_id
      AND s.status IN ('open', 'in_progress')
  ),
  updated_at = now()
  WHERE c.id = p_client_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_cs_client_support_ticket_count(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.trg_support_submission_sync_client_tickets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.client_id IS NOT NULL THEN
      PERFORM public.sync_cs_client_support_ticket_count(OLD.client_id);
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.client_id IS DISTINCT FROM NEW.client_id THEN
    IF OLD.client_id IS NOT NULL THEN
      PERFORM public.sync_cs_client_support_ticket_count(OLD.client_id);
    END IF;
  END IF;

  IF NEW.client_id IS NOT NULL THEN
    PERFORM public.sync_cs_client_support_ticket_count(NEW.client_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_submissions_sync_client_tickets ON public.support_submissions;
CREATE TRIGGER support_submissions_sync_client_tickets
  AFTER INSERT OR UPDATE OF client_id, status OR DELETE ON public.support_submissions
  FOR EACH ROW EXECUTE FUNCTION public.trg_support_submission_sync_client_tickets();

-- Allow "note" interaction type for automation logs
ALTER TABLE public.cs_interactions DROP CONSTRAINT IF EXISTS cs_interactions_type_check;
ALTER TABLE public.cs_interactions
  ADD CONSTRAINT cs_interactions_type_check
  CHECK (type IN ('email', 'call', 'meeting', 'note'));
