-- ============================================================
-- Migration 002 — Unique constraint on medication_logs slot
-- Run this in the Supabase SQL Editor on your existing database.
-- ============================================================

-- First remove any duplicate rows that already exist, keeping
-- only the most recently created one per slot.
delete from public.medication_logs
where id not in (
  select distinct on (medication_id, user_id, scheduled_at) id
  from public.medication_logs
  order by medication_id, user_id, scheduled_at, created_at desc
);

-- Add the unique constraint so concurrent upserts can never
-- produce duplicate rows for the same medication + slot.
alter table public.medication_logs
  add constraint medication_logs_slot_unique
  unique (medication_id, user_id, scheduled_at);
