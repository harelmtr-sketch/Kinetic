-- Add username, avatar_url, and bio to profiles
alter table public.profiles
  add column if not exists username text,
  add column if not exists avatar_url text,
  add column if not exists bio text;

-- Unique, case-insensitive username index
create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username))
  where username is not null;

-- Storage bucket for user avatars
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'avatars_authenticated_select'
  ) then
    create policy avatars_authenticated_select
      on storage.objects for select
      to authenticated
      using (bucket_id = 'avatars');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'avatars_authenticated_write'
  ) then
    create policy avatars_authenticated_write
      on storage.objects for all
      to authenticated
      using (bucket_id = 'avatars')
      with check (bucket_id = 'avatars');
  end if;
end $$;

-- Update friendships lookup to also support username
-- (no schema change needed; handled in application code)
