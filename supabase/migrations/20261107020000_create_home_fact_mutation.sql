create table app_private.home_fact_save_requests (
  trip_id uuid not null references app_private.trips(id) on delete cascade,
  idempotency_key uuid not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (trip_id, idempotency_key)
);

alter table app_private.home_fact_save_requests enable row level security;
alter table app_private.home_fact_save_requests force row level security;

revoke all on app_private.home_fact_save_requests from public, anon, authenticated;
grant select, insert on app_private.home_fact_save_requests to service_role;

create or replace function public.save_travel_facts(
  p_trip_id uuid,
  p_facts jsonb,
  p_expected_version bigint,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, app_private
as $$
declare
  v_current_version bigint;
  v_response jsonb;
begin
  if jsonb_typeof(p_facts) <> 'array' then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  select version.version
  into v_current_version
  from app_private.resource_versions as version
  where version.trip_id = p_trip_id and version.resource_type = 'home'
  for update;

  if v_current_version is null then
    raise exception using errcode = 'P0002', message = 'RESOURCE_NOT_FOUND';
  end if;

  select request.response
  into v_response
  from app_private.home_fact_save_requests as request
  where request.trip_id = p_trip_id and request.idempotency_key = p_idempotency_key;

  if v_response is not null then
    return v_response;
  end if;

  if v_current_version <> p_expected_version then
    raise exception using errcode = 'P0001', message = 'VERSION_CONFLICT';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_facts) as incoming(id uuid)
    join app_private.travel_facts as existing on existing.id = incoming.id
    where existing.trip_id <> p_trip_id
  ) then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  update app_private.travel_facts
  set sort_order = sort_order + 100000
  where trip_id = p_trip_id;

  insert into app_private.travel_facts (
    id,
    trip_id,
    icon,
    title,
    content,
    sort_order
  )
  select
    incoming.id,
    p_trip_id,
    incoming.icon,
    trim(incoming.title),
    trim(incoming.content),
    incoming."sortOrder"
  from jsonb_to_recordset(p_facts) as incoming(
    id uuid,
    icon text,
    title text,
    content text,
    "sortOrder" integer
  )
  on conflict (id) do update set
    icon = excluded.icon,
    title = excluded.title,
    content = excluded.content,
    sort_order = excluded.sort_order;

  delete from app_private.travel_facts as existing
  where existing.trip_id = p_trip_id
    and not exists (
      select 1
      from jsonb_to_recordset(p_facts) as incoming(id uuid)
      where incoming.id = existing.id
    );

  update app_private.resource_versions
  set version = version + 1, updated_at = now()
  where trip_id = p_trip_id and resource_type = 'home';

  v_response := public.get_trip_home(p_trip_id);

  insert into app_private.home_fact_save_requests (trip_id, idempotency_key, response)
  values (p_trip_id, p_idempotency_key, v_response);

  return v_response;
end;
$$;

revoke all on function public.save_travel_facts(uuid, jsonb, bigint, uuid) from public, anon, authenticated;
grant execute on function public.save_travel_facts(uuid, jsonb, bigint, uuid) to service_role;
