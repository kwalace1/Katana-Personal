-- Restore full module access for localhost / owner dev accounts.
-- Run in Supabase SQL Editor after supabase-org-modules-migration.sql
-- if your owner account was locked to core suite only.

UPDATE public.organizations o
SET
  subscription_tier = 'enterprise',
  subscription_status = COALESCE(o.subscription_status, 'active'),
  enabled_modules = ARRAY[
    'hub', 'projects', 'inventory', 'customer-success', 'workforce', 'hr',
    'employee', 'careers', 'manufacturing', 'automation', 'kyi', 'comms',
    'agents', 'support', 'finance'
  ]::text[],
  updated_at = now()
FROM public.user_profiles up
WHERE up.organization_id = o.id
  AND up.role IN ('owner', 'admin')
  AND (
    up.email ILIKE '%kevin%wallace%'
    OR up.full_name ILIKE '%Kevin Wallace%'
    OR up.email ILIKE '%@localhost%'
    OR up.email ILIKE '%dev@%'
  );

-- Optional: upgrade ALL orgs owned by an owner/admin on free/starter (local dev projects)
-- Uncomment if you want every dev org on full stack in the database:
--
-- UPDATE public.organizations
-- SET
--   subscription_tier = 'enterprise',
--   enabled_modules = ARRAY[
--     'hub', 'projects', 'inventory', 'customer-success', 'workforce', 'hr',
--     'employee', 'careers', 'manufacturing', 'automation', 'kyi', 'comms',
--     'agents', 'support', 'finance'
--   ]::text[],
--   updated_at = now()
-- WHERE subscription_tier IN ('free', 'starter')
--   AND id IN (
--     SELECT organization_id FROM public.user_profiles WHERE role IN ('owner', 'admin')
--   );
