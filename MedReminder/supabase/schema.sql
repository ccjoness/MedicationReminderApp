-- ============================================================
-- MedReminder — Supabase Database Schema
-- Run this in the Supabase SQL Editor (Project → SQL Editor).
-- ============================================================

-- ----------------------------------------------------------------
-- Enable required extensions
-- ----------------------------------------------------------------
create extension if not exists "uuid-ossp";

-- ----------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text        not null,
  display_name  text        not null default '',
  avatar_url    text,
  created_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Automatically create a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ----------------------------------------------------------------
-- medications
-- ----------------------------------------------------------------
create table if not exists public.medications (
  id                      uuid        primary key default gen_random_uuid(),
  user_id                 uuid        not null references public.profiles(id) on delete cascade,
  name                    text        not null,
  dosage                  text        not null,
  notes                   text,
  photo_url               text,
  snooze_interval_minutes integer     not null default 30,
  refill_count            integer,
  low_refill_threshold    integer,
  is_active               boolean     not null default true,
  created_at              timestamptz not null default now()
);

alter table public.medications enable row level security;

create policy "Users can view own medications"
  on public.medications for select
  using (auth.uid() = user_id);

create policy "Users can insert own medications"
  on public.medications for insert
  with check (auth.uid() = user_id);

create policy "Users can update own medications"
  on public.medications for update
  using (auth.uid() = user_id);

create policy "Users can delete own medications"
  on public.medications for delete
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- medication_schedules
-- ----------------------------------------------------------------
create table if not exists public.medication_schedules (
  id            uuid        primary key default gen_random_uuid(),
  medication_id uuid        not null references public.medications(id) on delete cascade,
  -- 0=Sunday … 6=Saturday; empty array means every day
  days_of_week  integer[]   not null default '{}',
  -- 24-hour time, e.g. "08:00:00"
  time_of_day   time        not null,
  created_at    timestamptz not null default now()
);

alter table public.medication_schedules enable row level security;

create policy "Users can view own schedules"
  on public.medication_schedules for select
  using (
    exists (
      select 1 from public.medications m
      where m.id = medication_id and m.user_id = auth.uid()
    )
  );

create policy "Users can insert own schedules"
  on public.medication_schedules for insert
  with check (
    exists (
      select 1 from public.medications m
      where m.id = medication_id and m.user_id = auth.uid()
    )
  );

create policy "Users can update own schedules"
  on public.medication_schedules for update
  using (
    exists (
      select 1 from public.medications m
      where m.id = medication_id and m.user_id = auth.uid()
    )
  );

create policy "Users can delete own schedules"
  on public.medication_schedules for delete
  using (
    exists (
      select 1 from public.medications m
      where m.id = medication_id and m.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------
-- medication_logs
-- ----------------------------------------------------------------
create table if not exists public.medication_logs (
  id            uuid        primary key default gen_random_uuid(),
  medication_id uuid        not null references public.medications(id) on delete cascade,
  user_id       uuid        not null references public.profiles(id) on delete cascade,
  scheduled_at  timestamptz not null,
  -- pending | taken | missed | snoozed
  status        text        not null default 'pending'
                            check (status in ('pending','taken','missed','snoozed')),
  taken_at      timestamptz,
  snooze_count  integer     not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists medication_logs_user_scheduled
  on public.medication_logs(user_id, scheduled_at);

alter table public.medication_logs enable row level security;

create policy "Users can view own logs"
  on public.medication_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert own logs"
  on public.medication_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own logs"
  on public.medication_logs for update
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- Storage bucket: medication-photos
-- ----------------------------------------------------------------
-- Run this separately in the Supabase Storage settings, or via SQL:
insert into storage.buckets (id, name, public)
values ('medication-photos', 'medication-photos', false)
on conflict (id) do nothing;

-- Allow authenticated users to upload to their own folder
create policy "Users can upload own photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'medication-photos' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to view their own photos
create policy "Users can view own photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'medication-photos' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to update (replace) their own photos
create policy "Users can update own photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'medication-photos' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to delete their own photos
create policy "Users can delete own photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'medication-photos' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- ----------------------------------------------------------------
-- Atomic refill count decrement (prevents TOCTOU race condition)
-- ----------------------------------------------------------------
create or replace function public.decrement_refill_count(med_id uuid)
returns void language plpgsql security definer as $$
declare
  v_new_count integer;
  v_threshold integer;
  v_name text;
begin
  update public.medications
  set refill_count = greatest(0, refill_count - 1)
  where id = med_id
    and user_id = auth.uid()
    and refill_count is not null
  returning refill_count, low_refill_threshold, name
    into v_new_count, v_threshold, v_name;

  -- Fire a low-refill notification if threshold crossed
  -- (actual push notification is sent client-side after this RPC returns)
end;
$$;

-- ----------------------------------------------------------------
-- Account deletion
-- ----------------------------------------------------------------
-- Deleting the auth.users row cascades to profiles, medications,
-- medication_schedules, and medication_logs via foreign keys.
create or replace function public.delete_user()
returns void language plpgsql security definer as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;
