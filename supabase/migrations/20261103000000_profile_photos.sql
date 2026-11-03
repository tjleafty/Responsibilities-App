-- Kid profile photos (taken during setup or in Family > Edit kid).
-- The app saves a small square JPEG (256 px, about 15 KB) as a data URL, so no
-- storage bucket or extra policies are needed: the row's existing RLS covers it.
alter table public.family_profiles add column if not exists photo_url text;

-- Keep photos small: refuse anything over ~200 KB so one profile can't bloat every load.
alter table public.family_profiles drop constraint if exists family_profiles_photo_url_size;
alter table public.family_profiles add constraint family_profiles_photo_url_size
  check (photo_url is null or length(photo_url) <= 200000);

-- Tell the API about the new column right away.
notify pgrst, 'reload schema';
