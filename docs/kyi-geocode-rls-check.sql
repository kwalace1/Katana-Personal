-- Run in Supabase SQL Editor to verify RLS allows UPDATE on kyi_investor_leads.
-- If "Allow all on kyi_investor_leads" exists and cmd = 'UPDATE', you're good.
-- If no policy allows UPDATE for anon/authenticated, add one (see supabase-kyi-schema.sql).

select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual::text   as using_expr,
  with_check::text
from pg_policies
where tablename = 'kyi_investor_leads'
order by policyname;
