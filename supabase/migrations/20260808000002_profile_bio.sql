-- Profile bio for Social profiles (photo_url already exists)
alter table public.profiles
  add column if not exists bio text;

-- Keep bios short in the app; DB allows a bit more headroom
do $$
begin
  alter table public.profiles
    add constraint profiles_bio_len check (bio is null or char_length(bio) <= 280);
exception
  when duplicate_object then null;
end $$;
