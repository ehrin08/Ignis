-- Run through the Supabase CLI or SQL editor. All schedule content is scoped to auth.uid().
create table if not exists public.ignis_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('settings', 'series', 'duty', 'exception')),
  entity_id text not null,
  updated_at bigint not null,
  device_id text not null,
  deleted_at bigint,
  payload jsonb not null default '{}'::jsonb,
  primary key (user_id, entity_type, entity_id)
);

alter table public.ignis_records enable row level security;
create policy "Users access their own Ignis records" on public.ignis_records
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

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
  payload jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  record_device_id := coalesce(p_snapshot->>'deviceId', 'unknown-device');

  -- Normalize all client records into one conflict-safe stream. A timestamp tie is broken by device id.
  for record_type, incoming in select * from jsonb_each(jsonb_build_object(
    'settings', case when p_snapshot->'settings' is null then '[]'::jsonb else jsonb_build_array(p_snapshot->'settings') end,
    'series', coalesce(p_snapshot->'series', '[]'::jsonb),
    'duty', coalesce(p_snapshot->'duties', '[]'::jsonb),
    'exception', coalesce(p_snapshot->'exceptions', '[]'::jsonb)
  )) loop
    for record_item in select * from jsonb_array_elements(incoming) loop
      record_id := case record_type
        when 'settings' then 'settings'
        when 'exception' then record_item->>'series_id' || ':' || record_item->>'occurrence_date'
        else record_item->>'id'
      end;
      record_updated_at := coalesce((record_item->>'updated_at')::bigint, (extract(epoch from clock_timestamp()) * 1000)::bigint);
      if record_id is null then continue; end if;
      insert into public.ignis_records (user_id, entity_type, entity_id, updated_at, device_id, payload)
      values (auth.uid(), record_type, record_id, record_updated_at, record_device_id, record_item)
      on conflict (user_id, entity_type, entity_id) do update set
        updated_at = excluded.updated_at, device_id = excluded.device_id, deleted_at = null, payload = excluded.payload
      where excluded.updated_at > ignis_records.updated_at
        or (excluded.updated_at = ignis_records.updated_at and excluded.device_id > ignis_records.device_id);
    end loop;
  end loop;

  for record_item in select * from jsonb_array_elements(coalesce(p_snapshot->'tombstones', '[]'::jsonb)) loop
    record_type := record_item->>'entity_type';
    record_id := record_item->>'entity_id';
    record_deleted_at := (record_item->>'deleted_at')::bigint;
    insert into public.ignis_records (user_id, entity_type, entity_id, updated_at, device_id, deleted_at)
    values (auth.uid(), record_type, record_id, record_deleted_at, coalesce(record_item->>'device_id', record_device_id), record_deleted_at)
    on conflict (user_id, entity_type, entity_id) do update set
      updated_at = excluded.updated_at, device_id = excluded.device_id, deleted_at = excluded.deleted_at, payload = '{}'::jsonb
    where excluded.updated_at > ignis_records.updated_at
      or (excluded.updated_at = ignis_records.updated_at and excluded.device_id > ignis_records.device_id);
  end loop;

  return jsonb_build_object(
    'deviceId', record_device_id,
    'settings', (select payload from public.ignis_records where user_id = auth.uid() and entity_type = 'settings' and deleted_at is null limit 1),
    'series', coalesce((select jsonb_agg(payload) from public.ignis_records where user_id = auth.uid() and entity_type = 'series' and deleted_at is null), '[]'::jsonb),
    'duties', coalesce((select jsonb_agg(payload) from public.ignis_records where user_id = auth.uid() and entity_type = 'duty' and deleted_at is null), '[]'::jsonb),
    'exceptions', coalesce((select jsonb_agg(payload) from public.ignis_records where user_id = auth.uid() and entity_type = 'exception' and deleted_at is null), '[]'::jsonb),
    'tombstones', coalesce((select jsonb_agg(jsonb_build_object('entity_type', entity_type, 'entity_id', entity_id, 'deleted_at', deleted_at, 'device_id', device_id)) from public.ignis_records where user_id = auth.uid() and deleted_at is not null), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.sync_ignis_snapshot(jsonb) to authenticated;
