-- Automation document knowledge: extracted text + search for org docs.
-- Run in Supabase SQL Editor after supabase-automation-migration.sql.
-- Idempotent.

-- ---------------------------------------------------------------------------
-- Extracted document text (org-scoped; NOT system rag_documents)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.automation_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  storage_file_id uuid NOT NULL REFERENCES public.storage_files(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  mime_type text,
  extracted_text text,
  extract_status text NOT NULL DEFAULT 'pending'
    CHECK (extract_status IN ('pending', 'ready', 'unsupported', 'failed')),
  extract_error text,
  char_count integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (storage_file_id)
);

CREATE INDEX IF NOT EXISTS automation_documents_org_created_idx
  ON public.automation_documents (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS automation_documents_org_status_idx
  ON public.automation_documents (organization_id, extract_status);

CREATE INDEX IF NOT EXISTS automation_documents_fts_idx
  ON public.automation_documents
  USING gin (to_tsvector('english', coalesce(extracted_text, '')));

ALTER TABLE public.automation_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_isolation_automation_documents" ON public.automation_documents;
CREATE POLICY "org_isolation_automation_documents" ON public.automation_documents
  FOR ALL
  USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());

COMMENT ON TABLE public.automation_documents IS
  'Org-scoped Automation knowledge: extracted text from uploaded files for search and agents.';

-- ---------------------------------------------------------------------------
-- Full-text / ILIKE search (callable via ai_query SELECT)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_automation_documents(
  p_query text,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  storage_file_id uuid,
  file_name text,
  extract_status text,
  char_count integer,
  snippet text,
  rank real,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH q AS (
    SELECT nullif(btrim(p_query), '') AS query,
           greatest(1, least(coalesce(p_limit, 10), 50)) AS lim
  ),
  ranked AS (
    SELECT
      d.id,
      d.storage_file_id,
      d.file_name,
      d.extract_status,
      d.char_count,
      CASE
        WHEN length(coalesce(d.extracted_text, '')) > 600
          THEN left(d.extracted_text, 600) || '…'
        ELSE coalesce(d.extracted_text, '')
      END AS snippet,
      CASE
        WHEN q.query IS NULL THEN 0::real
        WHEN to_tsvector('english', coalesce(d.extracted_text, ''))
             @@ plainto_tsquery('english', q.query)
          THEN ts_rank(
            to_tsvector('english', coalesce(d.extracted_text, '')),
            plainto_tsquery('english', q.query)
          )
        WHEN d.file_name ILIKE '%' || q.query || '%' THEN 0.4::real
        WHEN d.extracted_text ILIKE '%' || q.query || '%' THEN 0.2::real
        ELSE 0::real
      END AS rank,
      d.created_at
    FROM public.automation_documents d
    CROSS JOIN q
    WHERE d.organization_id = public.get_user_organization_id()
      AND d.extract_status = 'ready'
      AND q.query IS NOT NULL
      AND (
        to_tsvector('english', coalesce(d.extracted_text, ''))
          @@ plainto_tsquery('english', q.query)
        OR d.file_name ILIKE '%' || q.query || '%'
        OR d.extracted_text ILIKE '%' || q.query || '%'
      )
  )
  SELECT *
  FROM ranked
  ORDER BY rank DESC, created_at DESC
  LIMIT (SELECT lim FROM q);
$$;

REVOKE ALL ON FUNCTION public.search_automation_documents(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_automation_documents(text, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- Agent-facing views (security_invoker + SELECT for authenticated)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.ai_automation_documents AS
SELECT
  id,
  storage_file_id,
  file_name,
  mime_type,
  extract_status,
  extract_error,
  char_count,
  CASE
    WHEN length(coalesce(extracted_text, '')) > 8000
      THEN left(extracted_text, 8000) || '…'
    ELSE extracted_text
  END AS content_preview,
  created_at,
  updated_at,
  organization_id
FROM public.automation_documents;

CREATE OR REPLACE VIEW public.ai_automation_jobs AS
SELECT
  id,
  job_type,
  status,
  title,
  error_message,
  created_at,
  completed_at,
  organization_id
FROM public.automation_jobs;

CREATE OR REPLACE VIEW public.ai_automation_summary AS
SELECT
  (SELECT count(*) FROM public.automation_documents
     WHERE extract_status = 'ready') AS indexed_documents,
  (SELECT count(*) FROM public.automation_documents) AS total_documents,
  (SELECT count(*) FROM public.storage_files
     WHERE module = 'automation') AS total_files,
  (SELECT count(*) FROM public.automation_jobs) AS total_jobs,
  (SELECT count(*) FROM public.automation_jobs
     WHERE status = 'completed') AS completed_jobs,
  (SELECT count(*) FROM public.automation_jobs
     WHERE status = 'failed') AS failed_jobs,
  (SELECT count(*) FROM public.rag_documents) AS system_rag_chunks;

DO $$
DECLARE v text;
BEGIN
  FOREACH v IN ARRAY ARRAY[
    'ai_automation_documents',
    'ai_automation_jobs',
    'ai_automation_summary'
  ]
  LOOP
    EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', v);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', v);
  END LOOP;
END $$;
