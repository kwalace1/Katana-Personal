-- =============================================================================
-- KYI shared-directory enrichment backfill (quality sources → focus / history)
-- Additive: only fills empty investment_focus / public_history / industry.
-- Run after ecosystem + quality-cleanup migrations.
-- =============================================================================

-- From linked quality leads: build a short public history line from sources
WITH lead_bits AS (
  SELECT
    g.id AS global_id,
    nullif(trim(coalesce(
      l.metadata->>'firm',
      l.metadata->>'company',
      g.firm,
      ''
    )), '') AS firm_hint,
    nullif(trim(coalesce(
      l.metadata->>'industry',
      l.metadata->>'sector',
      g.industry,
      ''
    )), '') AS industry_hint,
    nullif(trim(coalesce(
      l.metadata->>'investment_focus',
      l.metadata->>'focus',
      l.metadata->>'thesis',
      ''
    )), '') AS focus_hint,
    (
      SELECT string_agg(DISTINCT coalesce(s->>'source_name', s->>'name', ''), ', ')
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(l.sources) = 'array' THEN l.sources ELSE '[]'::jsonb END
      ) s
      WHERE coalesce(s->>'source_name', s->>'name', '') ~*
        '(SEC|ADV|13F|WIKIDATA|FINRA|OPENCORPORATES|COMPANIES.?HOUSE)'
    ) AS quality_sources
  FROM public.kyi_global_investors g
  JOIN public.kyi_investor_leads l ON l.global_investor_id = g.id
  WHERE coalesce(l.organization_id::text, '') = ''
     OR l.organization_id IS NULL
)
UPDATE public.kyi_global_investors g
SET
  firm = coalesce(nullif(trim(g.firm), ''), lb.firm_hint, g.firm),
  industry = coalesce(nullif(trim(g.industry), ''), lb.industry_hint, g.industry),
  investment_focus = coalesce(
    nullif(trim(g.investment_focus), ''),
    lb.focus_hint,
    CASE
      WHEN lb.industry_hint IS NOT NULL THEN 'Focus areas include ' || lb.industry_hint
      ELSE g.investment_focus
    END
  ),
  public_history = coalesce(
    nullif(trim(g.public_history), ''),
    CASE
      WHEN lb.quality_sources IS NOT NULL AND length(lb.quality_sources) > 0
        THEN 'Public records: ' || lb.quality_sources
      ELSE g.public_history
    END
  ),
  updated_at = now()
FROM lead_bits lb
WHERE g.id = lb.global_id
  AND (
    nullif(trim(g.investment_focus), '') IS NULL
    OR nullif(trim(g.public_history), '') IS NULL
    OR nullif(trim(g.industry), '') IS NULL
  );

-- From tenant investors linked to global: fill sparse public fields (never-safe only)
UPDATE public.kyi_global_investors g
SET
  firm = coalesce(nullif(trim(g.firm), ''), nullif(trim(i.firm), ''), g.firm),
  title = coalesce(nullif(trim(g.title), ''), nullif(trim(i.title), ''), g.title),
  location = coalesce(nullif(trim(g.location), ''), nullif(trim(i.location), ''), g.location),
  industry = coalesce(nullif(trim(g.industry), ''), nullif(trim(i.industry), ''), g.industry),
  profile_url = coalesce(nullif(trim(g.profile_url), ''), nullif(trim(i.profile_url), ''), g.profile_url),
  investment_focus = coalesce(
    nullif(trim(g.investment_focus), ''),
    CASE
      WHEN nullif(trim(i.industry), '') IS NOT NULL
        THEN 'Industry focus: ' || trim(i.industry)
      ELSE g.investment_focus
    END
  ),
  updated_at = now()
FROM public.kyi_investors i
WHERE i.global_investor_id = g.id
  AND (
    nullif(trim(g.firm), '') IS NULL
    OR nullif(trim(g.industry), '') IS NULL
    OR nullif(trim(g.investment_focus), '') IS NULL
    OR nullif(trim(g.profile_url), '') IS NULL
  );
