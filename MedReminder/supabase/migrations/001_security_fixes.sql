-- ============================================================
-- Migration 001 — Security & bug fixes
-- Run this in Supabase SQL Editor on your existing database.
-- Safe to run on a database already set up with schema.sql.
-- ============================================================

-- ----------------------------------------------------------------
-- Storage: add missing UPDATE policy for medication-photos bucket
-- ----------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename  = 'objects'
      and policyname = 'Users can update own photos'
  ) then
    create policy "Users can update own photos"
      on storage.objects for update
      to authenticated
      using (
        bucket_id = 'medication-photos' and
        (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

-- ----------------------------------------------------------------
-- Atomic refill count decrement
-- Prevents TOCTOU race when "Took it" is tapped multiple times.
-- ----------------------------------------------------------------
create or replace function public.decrement_refill_count(med_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.medications
  set refill_count = greatest(0, refill_count - 1)
  where id       = med_id
    and user_id  = auth.uid()
    and refill_count is not null;
end;
$$;

-- ----------------------------------------------------------------
-- Account deletion
-- Cascades to profiles, medications, schedules, and logs via FK.
-- ----------------------------------------------------------------
create or replace function public.delete_user()
returns void language plpgsql security definer as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;
