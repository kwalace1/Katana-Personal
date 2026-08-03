-- =============================================================================
-- Platform operator lookup for cross-tenant support notifications
-- Run in Supabase Dashboard → SQL Editor (after support + notifications migrations)
-- =============================================================================

create or replace function public.get_katana_platform_operator_user_ids()
returns table(user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select up.id as user_id
  from public.user_profiles up
  where up.is_active = true
    and up.role in ('owner', 'admin')
    and lower(split_part(up.email, '@', 2)) in (
      'dwgrowthcapital.onmicrosoft.com',
      'dwgrowth.onmicrosoft.com'
    );
$$;

grant execute on function public.get_katana_platform_operator_user_ids() to authenticated;
