-- =============================================================================
-- Add 'support' to user_notifications source_module check constraint
-- Run in Supabase Dashboard → SQL Editor (after supabase-support-schema.sql)
-- =============================================================================

alter table public.user_notifications
  drop constraint if exists user_notifications_source_module_check;

alter table public.user_notifications
  add constraint user_notifications_source_module_check
  check (
    source_module in (
      'comms',
      'projects',
      'inventory',
      'customer_success',
      'hr',
      'workforce',
      'hub',
      'general',
      'support'
    )
  );
