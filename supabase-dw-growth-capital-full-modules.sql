-- DW Growth & Capital: full unrestricted module stack.
-- Run in Supabase SQL Editor after supabase-org-modules-migration.sql.
--
-- Org-level entitlements = ceiling (all 15 modules).
-- Per-user access is still controlled via HR → employee module_access checkboxes.

UPDATE public.organizations
SET
  subscription_tier = 'enterprise',
  subscription_status = COALESCE(subscription_status, 'active'),
  enabled_modules = ARRAY[
    'hub', 'projects', 'inventory', 'customer-success', 'workforce', 'hr',
    'employee', 'careers', 'manufacturing', 'automation', 'kyi', 'comms',
    'agents', 'support', 'finance'
  ]::text[],
  updated_at = now()
WHERE name ILIKE '%DW Growth%Capital%'
   OR slug ILIKE '%dw-growth%'
   OR slug ILIKE '%dwgrowth%';

-- Optional: grant all modules to active employees who have empty module_access.
-- Uncomment after reviewing — owners/admins already get full access via role.
--
-- UPDATE public.hr_employees e
-- SET module_access = ARRAY[
--   'hub', 'projects', 'inventory', 'customer-success', 'workforce', 'hr',
--   'employee', 'careers', 'manufacturing', 'automation', 'kyi', 'comms',
--   'agents', 'support', 'finance'
-- ]::text[],
-- updated_at = now()
-- FROM public.organizations o
-- WHERE e.organization_id = o.id
--   AND (o.name ILIKE '%DW Growth%Capital%' OR o.slug ILIKE '%dw-growth%' OR o.slug ILIKE '%dwgrowth%')
--   AND e.status = 'active'
--   AND (e.module_access IS NULL OR cardinality(e.module_access) = 0);
