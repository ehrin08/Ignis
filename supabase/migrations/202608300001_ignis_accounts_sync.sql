-- Ignis account-scoped snapshot sync. Apply with the Supabase CLI or SQL editor.
create table if not exists public.ignis_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('settings', 'series', 'duty', 'exception')),
  entity_id text not null,
  updated_at bigint not null check (updated_at >= 0),
  device_id text not null,
  deleted_at bigint check (deleted_at is null or deleted_at >= 0),
  payload jsonb not null default '{}'::jsonb,
  primary key (user_id, entity_type, entity_id)
);

alter table public.ignis_records enable row level security;

drop policy if exists "Users access their own Ignis records" on public.ignis_records;
create policy "Users access their own Ignis records" on public.ignis_records
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on table public.ignis_records from anon;
grant select, insert, update, delete on table public.ignis_records to authenticated;

create or replace function public.sync_ignis_snapshot(p_snapshot jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  incoming jsonb;
  record_item jsonb;
  record_type text;
  record_id text;
  record_updated_at bigint;
  record_device_id text;
  record_deleted_at bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_snapshot) <> 'object' then raise exception 'Snapshot must be an object'; end if;
  if pg_column_size(p_snapshot) > 5242880 then raise exception 'Snapshot is too large'; end if;

  record_device_id := nullif(trim(p_snapshot->>'deviceId'), '');
  if record_device_id is null or length(record_device_id) > 128 then
    raise exception 'Snapshot deviceId is invalid';
  end if;
  if jsonb_typeof(coalesce(p_snapshot->'series', '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_snapshot->'duties', '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_snapshot->'exceptions', '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_snapshot->'tombstones', '[]'::jsonb)) <> 'array' then
    raise exception 'Snapshot collections must be arrays';
  end if;

  for record_type, incoming in
    select * from jsonb_each(jsonb_build_object(
      'settings', case
        when p_snapshot->'settings' is null or p_snapshot->'settings' = 'null'::jsonb then '[]'::jsonb
        else jsonb_build_array(p_snapshot->'settings')
      end,
      'series', coalesce(p_snapshot->'series', '[]'::jsonb),
      'duty', coalesce(p_snapshot->'duties', '[]'::jsonb),
      'exception', coalesce(p_snapshot->'exceptions', '[]'::jsonb)
    ))
  loop
    for record_item in select * from jsonb_array_elements(incoming)
    loop
      if jsonb_typeof(record_item) <> 'object' then raise exception 'Snapshot record must be an object'; end if;
      if record_type = 'settings' and not (record_item ?& array[
        'id', 'onboarding_completed', 'currency_code', 'hourly_rate_minor', 'pay_cycle_type',
        'pay_cycle_anchor', 'overtime_mode', 'overtime_threshold_minutes', 'overtime_multiplier_bps',
        'night_differential_bps', 'night_differential_start_minutes', 'night_differential_end_minutes',
        'week_starts_on', 'updated_at'
      ]) then raise exception 'Settings payload is incomplete'; end if;
      if record_type = 'series' and not (record_item ?& array[
        'id', 'recurrence', 'start_date', 'end_date', 'weekday_mask', 'start_minutes', 'end_minutes',
        'timezone', 'break_seconds', 'rate_override_type', 'rate_override_minor', 'note', 'created_at', 'updated_at'
      ]) then raise exception 'Series payload is incomplete'; end if;
      if record_type = 'duty' and not (record_item ?& array[
        'id', 'series_id', 'occurrence_date', 'scheduled_start', 'scheduled_end', 'timezone',
        'break_seconds', 'rate_override_type', 'rate_override_minor', 'status', 'needs_review', 'note',
        'created_at', 'updated_at'
      ]) then raise exception 'Duty payload is incomplete'; end if;
      if record_type = 'exception' and not (record_item ?& array[
        'series_id', 'occurrence_date', 'created_at', 'updated_at'
      ]) then raise exception 'Exception payload is incomplete'; end if;
      record_id := case record_type
        when 'settings' then 'settings'
        when 'exception' then nullif(record_item->>'series_id', '') || ':' || nullif(record_item->>'occurrence_date', '')
        else nullif(record_item->>'id', '')
      end;
      record_updated_at := nullif(record_item->>'updated_at', '')::bigint;
      if record_id is null or length(record_id) > 512 or record_updated_at is null or record_updated_at < 0 then
        raise exception 'Snapshot record identity or timestamp is invalid';
      end if;

      insert into public.ignis_records (
        user_id, entity_type, entity_id, updated_at, device_id, deleted_at, payload
      ) values (
        auth.uid(), record_type, record_id, record_updated_at, record_device_id, null, record_item
      )
      on conflict (user_id, entity_type, entity_id) do update set
        updated_at = excluded.updated_at,
        device_id = excluded.device_id,
        deleted_at = null,
        payload = excluded.payload
      where excluded.updated_at > ignis_records.updated_at
        or (excluded.updated_at = ignis_records.updated_at and excluded.device_id > ignis_records.device_id);
    end loop;
  end loop;

  for record_item in
    select * from jsonb_array_elements(coalesce(p_snapshot->'tombstones', '[]'::jsonb))
  loop
    if jsonb_typeof(record_item) <> 'object' then raise exception 'Tombstone must be an object'; end if;
    record_type := record_item->>'entity_type';
    record_id := nullif(record_item->>'entity_id', '');
    record_deleted_at := nullif(record_item->>'deleted_at', '')::bigint;
    if record_type not in ('series', 'duty', 'exception')
      or record_id is null or length(record_id) > 512
      or record_deleted_at is null or record_deleted_at < 0 then
      raise exception 'Tombstone is invalid';
    end if;

    insert into public.ignis_records (
      user_id, entity_type, entity_id, updated_at, device_id, deleted_at, payload
    ) values (
      auth.uid(), record_type, record_id, record_deleted_at,
      coalesce(nullif(record_item->>'device_id', ''), record_device_id), record_deleted_at, '{}'::jsonb
    )
    on conflict (user_id, entity_type, entity_id) do update set
      updated_at = excluded.updated_at,
      device_id = excluded.device_id,
      deleted_at = excluded.deleted_at,
      payload = '{}'::jsonb
    where excluded.updated_at > ignis_records.updated_at
      or (excluded.updated_at = ignis_records.updated_at and excluded.device_id > ignis_records.device_id);
  end loop;

  return jsonb_build_object(
    'deviceId', record_device_id,
    'settings', (
      select payload from public.ignis_records
      where user_id = auth.uid() and entity_type = 'settings' and deleted_at is null
      limit 1
    ),
    'series', coalesce((
      select jsonb_agg(payload order by entity_id) from public.ignis_records
      where user_id = auth.uid() and entity_type = 'series' and deleted_at is null
    ), '[]'::jsonb),
    'duties', coalesce((
      select jsonb_agg(payload order by entity_id) from public.ignis_records
      where user_id = auth.uid() and entity_type = 'duty' and deleted_at is null
    ), '[]'::jsonb),
    'exceptions', coalesce((
      select jsonb_agg(payload order by entity_id) from public.ignis_records
      where user_id = auth.uid() and entity_type = 'exception' and deleted_at is null
    ), '[]'::jsonb),
    'tombstones', coalesce((
      select jsonb_agg(jsonb_build_object(
        'entity_type', entity_type,
        'entity_id', entity_id,
        'deleted_at', deleted_at,
        'device_id', device_id
      ) order by entity_type, entity_id)
      from public.ignis_records
      where user_id = auth.uid() and deleted_at is not null
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.sync_ignis_snapshot(jsonb) from public, anon;
grant execute on function public.sync_ignis_snapshot(jsonb) to authenticated;
