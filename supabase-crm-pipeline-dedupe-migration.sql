-- =============================================================================
-- Katana CRM — dedupe sales pipeline stages + prevent future duplicates
-- Run after supabase-crm-migration.sql (idempotent)
-- =============================================================================

-- Reassign deals from duplicate stages to the canonical row (lowest position, then oldest)
WITH keepers AS (
  SELECT DISTINCT ON (organization_id, lower(trim(name)))
    id AS keep_id,
    organization_id,
    lower(trim(name)) AS norm_name
  FROM public.cs_pipeline_stages
  ORDER BY organization_id, lower(trim(name)), position, created_at
),
to_remove AS (
  SELECT s.id AS remove_id, k.keep_id
  FROM public.cs_pipeline_stages s
  JOIN keepers k
    ON s.organization_id IS NOT DISTINCT FROM k.organization_id
   AND lower(trim(s.name)) = k.norm_name
   AND s.id <> k.keep_id
)
UPDATE public.cs_deals d
SET stage_id = tr.keep_id
FROM to_remove tr
WHERE d.stage_id = tr.remove_id;

WITH keepers AS (
  SELECT DISTINCT ON (organization_id, lower(trim(name)))
    id AS keep_id,
    organization_id,
    lower(trim(name)) AS norm_name
  FROM public.cs_pipeline_stages
  ORDER BY organization_id, lower(trim(name)), position, created_at
)
DELETE FROM public.cs_pipeline_stages s
USING keepers k
WHERE s.organization_id IS NOT DISTINCT FROM k.organization_id
  AND lower(trim(s.name)) = k.norm_name
  AND s.id <> k.keep_id;

CREATE UNIQUE INDEX IF NOT EXISTS cs_pipeline_stages_org_name_unique_idx
  ON public.cs_pipeline_stages (organization_id, lower(trim(name)));
