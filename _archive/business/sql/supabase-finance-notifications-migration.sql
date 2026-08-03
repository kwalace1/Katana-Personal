-- Add 'finance' to user_notifications source_module check constraint

ALTER TABLE public.user_notifications
  DROP CONSTRAINT IF EXISTS user_notifications_source_module_check;

ALTER TABLE public.user_notifications
  ADD CONSTRAINT user_notifications_source_module_check
  CHECK (source_module IN (
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
    'kyc',
    'finance'
  ));
