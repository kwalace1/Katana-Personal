-- Allow a signed-in user to delete their own Together profile (App Store account deletion).
create policy profiles_delete on public.profiles for delete to authenticated
  using (uid = public.uid_text());
