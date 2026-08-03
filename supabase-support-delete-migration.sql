-- =============================================================================
-- Allow deleting support submissions (own rows + org admin)
-- Run in Supabase Dashboard → SQL Editor
-- =============================================================================

drop policy if exists "Support: submitters can delete own" on public.support_submissions;
create policy "Support: submitters can delete own"
  on public.support_submissions for delete
  using (submitter_user_id = auth.uid());

drop policy if exists "Support: org admins can delete" on public.support_submissions;
create policy "Support: org admins can delete"
  on public.support_submissions for delete
  using (
    organization_id = (
      select organization_id from public.user_profiles where id = auth.uid()
    )
    and exists (
      select 1 from public.user_profiles
      where id = auth.uid()
      and role in ('owner', 'admin')
    )
  );
