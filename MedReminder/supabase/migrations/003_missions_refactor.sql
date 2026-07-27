-- Run once after migrations 001 and 002 to preserve existing accounts and data.
begin;

drop function if exists public.decrement_refill_count(uuid);
alter table public.medications rename to missions;
alter table public.missions rename column name to title;
alter table public.missions rename column dosage to description;
alter table public.missions rename column photo_url to image_url;
alter table public.missions drop column refill_count;
alter table public.missions drop column low_refill_threshold;
alter table public.missions alter column description drop not null;
alter table public.missions alter column snooze_interval_minutes set default 15;

alter table public.medication_schedules rename to mission_schedules;
alter table public.mission_schedules rename column medication_id to mission_id;

alter table public.medication_logs drop constraint if exists medication_logs_status_check;
update public.medication_logs set status = 'completed' where status = 'taken';
update public.medication_logs set status = 'expired' where status = 'missed';
alter table public.medication_logs rename to mission_occurrences;
alter table public.mission_occurrences rename column medication_id to mission_id;
alter table public.mission_occurrences rename column taken_at to completed_at;
alter table public.mission_occurrences add constraint mission_occurrences_status_check
  check (status in ('pending', 'completed', 'expired', 'snoozed'));
alter index if exists medication_logs_user_scheduled rename to mission_occurrences_user_scheduled;
alter table public.mission_occurrences rename constraint medication_logs_slot_unique to mission_occurrences_slot_unique;

insert into storage.buckets (id, name, public)
values ('mission-images', 'mission-images', false)
on conflict (id) do nothing;
create policy "Users can upload own mission images" on storage.objects for insert to authenticated
  with check (bucket_id = 'mission-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can view own mission images" on storage.objects for select to authenticated
  using (bucket_id = 'mission-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can update own mission images" on storage.objects for update to authenticated
  using (bucket_id = 'mission-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can delete own mission images" on storage.objects for delete to authenticated
  using (bucket_id = 'mission-images' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.delete_user()
returns void language plpgsql security definer set search_path = public, auth, storage as $$
begin
  delete from storage.objects
    where bucket_id in ('mission-images', 'medication-photos')
      and (storage.foldername(name))[1] = auth.uid()::text;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_user() from public;
grant execute on function public.delete_user() to authenticated;

commit;
