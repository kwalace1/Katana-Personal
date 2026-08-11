-- Allow friends (any authenticated user) to view profile avatars in the together bucket.
-- Paths: {uid}/profile/avatar.* — previously only the owner could SELECT, so signed URLs failed for others.
-- Also add UPDATE so avatar upsert:true re-uploads work.

drop policy if exists together_storage_select on storage.objects;
create policy together_storage_select on storage.objects for select to authenticated
  using (
    bucket_id = 'together'
    and (
      (storage.foldername(name))[1] = public.uid_text()
      or public.can_view_together_post((storage.foldername(name))[2])
      or (storage.foldername(name))[2] = 'profile'
    )
  );

drop policy if exists together_storage_update on storage.objects;
create policy together_storage_update on storage.objects for update to authenticated
  using (
    bucket_id = 'together'
    and (storage.foldername(name))[1] = public.uid_text()
  )
  with check (
    bucket_id = 'together'
    and (storage.foldername(name))[1] = public.uid_text()
  );
