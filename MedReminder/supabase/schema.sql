-- Quovi — fresh Supabase schema
-- Run this file only for a new project. Existing Lumidose databases should run
-- migrations/003_missions_refactor.sql instead.

create extension if not exists "uuid-ossp";

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table public.missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  notes text,
  image_url text,
  snooze_interval_minutes integer not null default 15,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.missions enable row level security;
create policy "Users can view own missions" on public.missions for select using (auth.uid() = user_id);
create policy "Users can insert own missions" on public.missions for insert with check (auth.uid() = user_id);
create policy "Users can update own missions" on public.missions for update using (auth.uid() = user_id);
create policy "Users can delete own missions" on public.missions for delete using (auth.uid() = user_id);

create table public.mission_schedules (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  days_of_week integer[] not null default '{}',
  time_of_day time not null,
  created_at timestamptz not null default now()
);

alter table public.mission_schedules enable row level security;
create policy "Users can view own mission schedules"
  on public.mission_schedules for select
  using (exists (select 1 from public.missions m where m.id = mission_id and m.user_id = auth.uid()));
create policy "Users can insert own mission schedules"
  on public.mission_schedules for insert
  with check (exists (select 1 from public.missions m where m.id = mission_id and m.user_id = auth.uid()));
create policy "Users can update own mission schedules"
  on public.mission_schedules for update
  using (exists (select 1 from public.missions m where m.id = mission_id and m.user_id = auth.uid()));
create policy "Users can delete own mission schedules"
  on public.mission_schedules for delete
  using (exists (select 1 from public.missions m where m.id = mission_id and m.user_id = auth.uid()));

create table public.mission_occurrences (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  scheduled_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'expired', 'snoozed')),
  completed_at timestamptz,
  snooze_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (mission_id, user_id, scheduled_at)
);

create index mission_occurrences_user_scheduled
  on public.mission_occurrences(user_id, scheduled_at);

alter table public.mission_occurrences enable row level security;
create policy "Users can view own mission occurrences"
  on public.mission_occurrences for select using (auth.uid() = user_id);
create policy "Users can insert own mission occurrences"
  on public.mission_occurrences for insert with check (auth.uid() = user_id);
create policy "Users can update own mission occurrences"
  on public.mission_occurrences for update using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('mission-images', 'mission-images', false)
on conflict (id) do nothing;

create policy "Users can upload own mission images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'mission-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can view own mission images"
  on storage.objects for select to authenticated
  using (bucket_id = 'mission-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can update own mission images"
  on storage.objects for update to authenticated
  using (bucket_id = 'mission-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can delete own mission images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'mission-images' and (storage.foldername(name))[1] = auth.uid()::text);
