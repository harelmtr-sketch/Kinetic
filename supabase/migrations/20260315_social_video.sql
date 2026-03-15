alter table public.profiles
  add column if not exists email text,
  add column if not exists display_name text;

create unique index if not exists profiles_email_key
  on public.profiles (email)
  where email is not null;

create table if not exists public.friendships (
  user_id uuid not null references auth.users (id) on delete cascade,
  friend_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  constraint friendships_not_self check (user_id <> friend_id)
);

create table if not exists public.user_skill_videos (
  user_id uuid not null references auth.users (id) on delete cascade,
  node_id text not null,
  storage_path text,
  mime_type text,
  created_at timestamptz not null default now(),
  primary key (user_id, node_id)
);

alter table public.friendships enable row level security;
alter table public.user_skill_videos enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'friendships'
      and policyname = 'friendships_authenticated_read'
  ) then
    create policy friendships_authenticated_read
      on public.friendships
      for select
      to authenticated
      using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'friendships'
      and policyname = 'friendships_authenticated_write'
  ) then
    create policy friendships_authenticated_write
      on public.friendships
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_skill_videos'
      and policyname = 'user_skill_videos_authenticated_read'
  ) then
    create policy user_skill_videos_authenticated_read
      on public.user_skill_videos
      for select
      to authenticated
      using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_skill_videos'
      and policyname = 'user_skill_videos_authenticated_write'
  ) then
    create policy user_skill_videos_authenticated_write
      on public.user_skill_videos
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'skill-videos',
  'skill-videos',
  true,
  524288000,
  array['video/mp4', 'video/quicktime', 'video/webm']
)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'skill_videos_authenticated_select'
  ) then
    create policy skill_videos_authenticated_select
      on storage.objects
      for select
      to authenticated
      using (bucket_id = 'skill-videos');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'skill_videos_authenticated_write'
  ) then
    create policy skill_videos_authenticated_write
      on storage.objects
      for all
      to authenticated
      using (bucket_id = 'skill-videos')
      with check (bucket_id = 'skill-videos');
  end if;
end $$;
