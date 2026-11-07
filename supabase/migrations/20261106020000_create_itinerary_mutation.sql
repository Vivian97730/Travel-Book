create table app_private.itinerary_save_requests (
  trip_day_id uuid not null references app_private.trip_days(id) on delete cascade,
  idempotency_key uuid not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (trip_day_id, idempotency_key)
);

alter table app_private.itinerary_save_requests enable row level security;
alter table app_private.itinerary_save_requests force row level security;

revoke all on app_private.itinerary_save_requests from public, anon, authenticated;
grant select, insert on app_private.itinerary_save_requests to service_role;

create or replace function public.save_trip_day_items(
  p_trip_id uuid,
  p_date date,
  p_items jsonb,
  p_expected_version bigint,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, app_private
as $$
declare
  v_day_id uuid;
  v_current_version bigint;
  v_response jsonb;
begin
  if jsonb_typeof(p_items) <> 'array' then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  select day.id, day.version
  into v_day_id, v_current_version
  from app_private.trip_days as day
  where day.trip_id = p_trip_id and day.local_date = p_date
  for update;

  if v_day_id is null then
    raise exception using errcode = 'P0002', message = 'RESOURCE_NOT_FOUND';
  end if;

  select request.response
  into v_response
  from app_private.itinerary_save_requests as request
  where request.trip_day_id = v_day_id and request.idempotency_key = p_idempotency_key;

  if v_response is not null then
    return v_response;
  end if;

  if v_current_version <> p_expected_version then
    raise exception using errcode = 'P0001', message = 'VERSION_CONFLICT';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as incoming(id uuid)
    join app_private.itinerary_items as existing on existing.id = incoming.id
    where existing.trip_day_id <> v_day_id
  ) then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  update app_private.itinerary_items
  set sort_order = sort_order + 100000
  where trip_day_id = v_day_id;

  insert into app_private.itinerary_items (
    id,
    trip_day_id,
    type,
    title,
    sort_order,
    place_id,
    notes
  )
  select
    incoming.id,
    v_day_id,
    incoming.category,
    trim(incoming.title),
    incoming."sortOrder",
    existing.place_id,
    trim(incoming.note)
  from jsonb_to_recordset(p_items) as incoming(
    id uuid,
    title text,
    note text,
    category text,
    "sortOrder" integer
  )
  left join app_private.itinerary_items as existing on existing.id = incoming.id
  on conflict (id) do update set
    type = excluded.type,
    title = excluded.title,
    sort_order = excluded.sort_order,
    place_id = excluded.place_id,
    notes = excluded.notes;

  delete from app_private.itinerary_items as existing
  where existing.trip_day_id = v_day_id
    and not exists (
      select 1
      from jsonb_to_recordset(p_items) as incoming(id uuid)
      where incoming.id = existing.id
    );

  update app_private.trip_days
  set version = version + 1
  where id = v_day_id;

  v_response := public.get_trip_day(p_trip_id, p_date);

  insert into app_private.itinerary_save_requests (trip_day_id, idempotency_key, response)
  values (v_day_id, p_idempotency_key, v_response);

  return v_response;
end;
$$;

revoke all on function public.save_trip_day_items(uuid, date, jsonb, bigint, uuid) from public, anon, authenticated;
grant execute on function public.save_trip_day_items(uuid, date, jsonb, bigint, uuid) to service_role;
