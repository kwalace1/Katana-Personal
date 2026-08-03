-- =============================================================================
-- Katana platform operators — view/manage ALL support submissions (every org)
-- Run in Supabase Dashboard → SQL Editor
--
-- Grants cross-tenant access to owner/admin users on @dwgrowthcapital.onmicrosoft.com
-- (and @dwgrowth.onmicrosoft.com). Adjust domains in is_katana_platform_operator() if needed.
-- =============================================================================

create or replace function public.is_katana_platform_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles up
    where up.id = auth.uid()
      and up.role in ('owner', 'admin')
      and lower(split_part(up.email, '@', 2)) in (
        'dwgrowthcapital.onmicrosoft.com',
        'dwgrowth.onmicrosoft.com'
      )
  );
$$;

drop policy if exists "Support: platform operators can view all" on public.support_submissions;
create policy "Support: platform operators can view all"
  on public.support_submissions for select
  using (public.is_katana_platform_operator());

drop policy if exists "Support: platform operators can update all" on public.support_submissions;
create policy "Support: platform operators can update all"
  on public.support_submissions for update
  using (public.is_katana_platform_operator());

drop policy if exists "Support: platform operators can delete all" on public.support_submissions;
create policy "Support: platform operators can delete all"
  on public.support_submissions for delete
  using (public.is_katana_platform_operator());
