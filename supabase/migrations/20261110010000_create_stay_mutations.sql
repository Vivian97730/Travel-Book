create table app_private.stay_mutation_requests (
  trip_id uuid not null references app_private.trips(id) on delete cascade,
  idempotency_key uuid not null,
  request jsonb not null,
  response jsonb not null,
  primary key (trip_id, idempotency_key)
);
alter table app_private.stay_mutation_requests enable row level security;
alter table app_private.stay_mutation_requests force row level security;
revoke all on app_private.stay_mutation_requests from public, anon, authenticated;
grant select, insert on app_private.stay_mutation_requests to service_role;

create function public.mutate_trip_stay(
  p_trip_id uuid, p_action text, p_id uuid, p_input jsonb,
  p_expected_version bigint, p_idempotency_key uuid
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, app_private
as $$
declare
  v_stay app_private.stays;
  v_id uuid := p_id;
  v_request jsonb;
  v_previous app_private.stay_mutation_requests;
  v_response jsonb;
begin
  if p_action is null or p_action not in ('create', 'update', 'delete') or p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;
  perform 1 from app_private.resource_versions
    where trip_id = p_trip_id and resource_type = 'stays' for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'RESOURCE_NOT_FOUND';
  end if;
  v_request := jsonb_build_object('action', p_action, 'id', p_id, 'input', p_input, 'version', p_expected_version);
  select * into v_previous from app_private.stay_mutation_requests
    where trip_id = p_trip_id and idempotency_key = p_idempotency_key;
  if found then
    if v_previous.request <> v_request then
      raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
    end if;
    return v_previous.response;
  end if;
  if p_action <> 'create' then
    select * into v_stay from app_private.stays where id = p_id and trip_id = p_trip_id for update;
    if not found then
      raise exception using errcode = 'P0002', message = 'RESOURCE_NOT_FOUND';
    end if;
    if p_expected_version is null or p_expected_version < 1 then
      raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
    end if;
    if v_stay.version <> p_expected_version then
      raise exception using errcode = 'P0001', message = 'VERSION_CONFLICT';
    end if;
  elsif p_id is not null or p_expected_version <> 0 or p_expected_version is null then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;
  if p_action <> 'delete' then
    if jsonb_typeof(p_input) is distinct from 'object'
      or not (p_input ?& array['name','city','address','startDate','endDate','checkin','checkout','photo'])
      or jsonb_typeof(p_input->'name') is distinct from 'string'
      or jsonb_typeof(p_input->'city') is distinct from 'string'
      or jsonb_typeof(p_input->'address') is distinct from 'string'
      or length(trim(p_input->>'name')) not between 1 and 80
      or length(trim(p_input->>'city')) not between 1 and 40
      or length(trim(p_input->>'address')) not between 1 and 160
      or coalesce(p_input->>'startDate', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      or coalesce(p_input->>'endDate', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      or coalesce(p_input->>'checkin', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      or coalesce(p_input->>'checkout', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
      raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
    end if;
    -- Photo selection is introduced by the Places task. Existing metadata may only be retained.
    if p_input->'photo' <> 'null'::jsonb and (
      p_action = 'create' or p_input->'photo' is distinct from
        (select item->'photo' from jsonb_array_elements(public.get_trip_stays(p_trip_id)->'stays') item
          where item->>'id' = p_id::text)
    ) then
      raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
    end if;
    if p_action = 'create' then
      insert into app_private.stays(trip_id, name, city, address, start_date, end_date, check_in_time, check_out_time)
      values (p_trip_id, trim(p_input->>'name'), trim(p_input->>'city'), trim(p_input->>'address'),
        (p_input->>'startDate')::date, (p_input->>'endDate')::date,
        (p_input->>'checkin')::time, (p_input->>'checkout')::time) returning id into v_id;
    else
      update app_private.stays set name = trim(p_input->>'name'), city = trim(p_input->>'city'),
        address = trim(p_input->>'address'), start_date = (p_input->>'startDate')::date,
        end_date = (p_input->>'endDate')::date, check_in_time = (p_input->>'checkin')::time,
        check_out_time = (p_input->>'checkout')::time, version = version + 1
      where id = p_id and trip_id = p_trip_id;
    end if;
    select jsonb_build_object('schemaVersion', 1, 'stays', jsonb_build_array(item)) into v_response
      from jsonb_array_elements(public.get_trip_stays(p_trip_id)->'stays') item where item->>'id' = v_id::text;
  else
    delete from app_private.stays where id = p_id and trip_id = p_trip_id;
    v_response := jsonb_build_object('schemaVersion', 1, 'stays', '[]'::jsonb);
  end if;
  update app_private.resource_versions set version = version + 1, updated_at = now()
    where trip_id = p_trip_id and resource_type = 'stays';
  insert into app_private.stay_mutation_requests values (p_trip_id, p_idempotency_key, v_request, v_response);
  return v_response;
exception
  when check_violation or invalid_datetime_format or datetime_field_overflow
    or invalid_text_representation or not_null_violation then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
end;
$$;
revoke all on function public.mutate_trip_stay(uuid, text, uuid, jsonb, bigint, uuid) from public, anon, authenticated;
grant execute on function public.mutate_trip_stay(uuid, text, uuid, jsonb, bigint, uuid) to service_role;
