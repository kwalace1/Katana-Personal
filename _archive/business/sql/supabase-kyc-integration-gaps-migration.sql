-- =============================================================================
-- Katana KYC / CS integration gaps — CSM auth link, campaign attribution,
-- support ticket events sync, notifications source module
-- Run after supabase-kyc-intelligence-expansion-migration.sql and
-- supabase-crm-phase2-migration.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Gap 1: Hard-link CSM records to platform auth users
-- -----------------------------------------------------------------------------
ALTER TABLE public.csm_users
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS csm_users_auth_user_id_idx
  ON public.csm_users(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

COMMENT ON COLUMN public.csm_users.auth_user_id IS
  'Linked Katana platform user for notifications and assignments. Preferred over email matching.';

-- -----------------------------------------------------------------------------
-- Gap 6: Preserve campaign / lead attribution on customer accounts
-- -----------------------------------------------------------------------------
ALTER TABLE public.cs_clients
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.cs_campaigns(id) ON DELETE SET NULL;

ALTER TABLE public.cs_clients
  ADD COLUMN IF NOT EXISTS source_lead_id uuid REFERENCES public.cs_leads(id) ON DELETE SET NULL;

ALTER TABLE public.cs_clients
  ADD COLUMN IF NOT EXISTS lead_source text;

CREATE INDEX IF NOT EXISTS cs_clients_campaign_id_idx
  ON public.cs_clients(campaign_id)
  WHERE campaign_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Gap 2: Allow KYC intelligence notifications
-- -----------------------------------------------------------------------------
ALTER TABLE public.user_notifications
  DROP CONSTRAINT IF EXISTS user_notifications_source_module_check;

ALTER TABLE public.user_notifications
  ADD CONSTRAINT user_notifications_source_module_check
  CHECK (
    source_module IN (
      'comms',
      'projects',
      'inventory',
      'customer_success',
      'hr',
      'workforce',
      'hub',
      'general',
      'support',
      'kyi',
      'kyc'
    )
  );

-- -----------------------------------------------------------------------------
-- Gap 5: Mirror support_submissions into cs_support_ticket_events for timeline
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_support_submission_to_ticket_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.cs_support_ticket_events
    WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.client_id IS NULL THEN
    IF TG_OP = 'UPDATE' AND OLD.client_id IS NOT NULL THEN
      DELETE FROM public.cs_support_ticket_events WHERE id = OLD.id;
    END IF;
    RETURN NEW;
  END IF;

  v_status := CASE
    WHEN NEW.status IN ('resolved', 'closed') THEN 'resolved'
    WHEN NEW.status IN ('escalated') THEN 'escalated'
    ELSE 'open'
  END;

  INSERT INTO public.cs_support_ticket_events (
    id,
    client_id,
    organization_id,
    subject,
    status,
    opened_at,
    closed_at
  )
  VALUES (
    NEW.id,
    NEW.client_id,
    NEW.organization_id,
    COALESCE(NULLIF(trim(NEW.subject), ''), 'Support ticket'),
    v_status,
    COALESCE(NEW.created_at, now()),
    CASE WHEN v_status = 'resolved' THEN COALESCE(NEW.updated_at, now()) ELSE NULL END
  )
  ON CONFLICT (id) DO UPDATE SET
    client_id = EXCLUDED.client_id,
    organization_id = EXCLUDED.organization_id,
    subject = EXCLUDED.subject,
    status = EXCLUDED.status,
    closed_at = EXCLUDED.closed_at;

  RETURN NEW;
END;
$$;

-- cs_support_ticket_events may use uuid default; align id with submission id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'cs_support_ticket_events'
  ) THEN
    ALTER TABLE public.cs_support_ticket_events
      ALTER COLUMN id DROP DEFAULT;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DROP TRIGGER IF EXISTS support_submissions_sync_ticket_events ON public.support_submissions;
CREATE TRIGGER support_submissions_sync_ticket_events
  AFTER INSERT OR UPDATE OF client_id, subject, status, organization_id OR DELETE
  ON public.support_submissions
  FOR EACH ROW EXECUTE FUNCTION public.sync_support_submission_to_ticket_event();

-- Backfill existing linked submissions
INSERT INTO public.cs_support_ticket_events (
  id, client_id, organization_id, subject, status, opened_at, closed_at
)
SELECT
  s.id,
  s.client_id,
  s.organization_id,
  COALESCE(NULLIF(trim(s.subject), ''), 'Support ticket'),
  CASE
    WHEN s.status IN ('resolved', 'closed') THEN 'resolved'
    WHEN s.status = 'escalated' THEN 'escalated'
    ELSE 'open'
  END,
  COALESCE(s.created_at, now()),
  CASE WHEN s.status IN ('resolved', 'closed') THEN s.updated_at ELSE NULL END
FROM public.support_submissions s
WHERE s.client_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;
