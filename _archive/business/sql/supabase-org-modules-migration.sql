-- Organization-level module entitlements (what the client has purchased / been provisioned)

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS enabled_modules text[] DEFAULT NULL;

COMMENT ON COLUMN public.organizations.enabled_modules IS
  'Explicit module IDs this org is entitled to. When NULL, derived from subscription_tier or settings.enabled_modules.';

-- Enterprise orgs: full stack
UPDATE public.organizations
SET enabled_modules = ARRAY[
  'hub', 'projects', 'inventory', 'customer-success', 'workforce', 'hr',
  'employee', 'careers', 'manufacturing', 'automation', 'kyi', 'comms',
  'agents', 'support', 'finance'
]::text[]
WHERE subscription_tier = 'enterprise'
  AND enabled_modules IS NULL;

-- Professional: core + common add-ons
UPDATE public.organizations
SET enabled_modules = ARRAY[
  'hub', 'customer-success', 'employee', 'support', 'projects', 'hr',
  'careers', 'workforce', 'inventory', 'comms', 'finance', 'automation'
]::text[]
WHERE subscription_tier = 'professional'
  AND enabled_modules IS NULL;

-- Starter
UPDATE public.organizations
SET enabled_modules = ARRAY[
  'hub', 'customer-success', 'employee', 'support', 'projects', 'hr', 'careers'
]::text[]
WHERE subscription_tier = 'starter'
  AND enabled_modules IS NULL;

-- Free / trial default core suite
UPDATE public.organizations
SET enabled_modules = ARRAY[
  'hub', 'customer-success', 'employee', 'support'
]::text[]
WHERE subscription_tier = 'free'
  AND enabled_modules IS NULL;
