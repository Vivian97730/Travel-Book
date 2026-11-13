create table app_private.shared_checklist_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references app_private.trips(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200 and title ~ '[^[:space:]]'),
  is_done boolean not null default false,
  sort_order bigint not null check (sort_order between 0 and 9007199254740991),
  version bigint not null default 1 check (version between 1 and 9007199254740991)
);

create index shared_checklist_trip_order_idx
  on app_private.shared_checklist_items(trip_id, sort_order, id);

create table app_private.shared_checklist_mutation_requests (
  trip_id uuid not null references app_private.trips(id) on delete cascade,
  idempotency_key uuid not null,
  request jsonb not null,
  primary key (trip_id, idempotency_key)
);

alter table app_private.shared_checklist_items enable row level security;
alter table app_private.shared_checklist_items force row level security;
alter table app_private.shared_checklist_mutation_requests enable row level security;
alter table app_private.shared_checklist_mutation_requests force row level security;
revoke all on app_private.shared_checklist_items, app_private.shared_checklist_mutation_requests
  from public, anon, authenticated;

create function public.get_trip_shared_checklist(p_trip_id uuid)
returns jsonb language sql stable security definer
set search_path = pg_catalog, app_private
as $$
  select jsonb_build_object('schemaVersion', 1, 'version', coalesce((
    select version from app_private.resource_versions
    where trip_id = p_trip_id and resource_type = 'checklists'
  ), 1), 'items', coalesce((
    select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'isDone', is_done,
      'sortOrder', sort_order, 'version', version) order by sort_order, id)
    from app_private.shared_checklist_items where trip_id = p_trip_id
  ), '[]'::jsonb))
  from app_private.trips where id = p_trip_id;
$$;

create function public.mutate_trip_shared_checklist(
  p_trip_id uuid, p_action text, p_id uuid, p_input jsonb,
  p_expected_version bigint, p_idempotency_key uuid
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, app_private
as $$
declare
  v_request jsonb := jsonb_build_array(p_action, p_id, p_input, p_expected_version);
  v_previous jsonb;
  v_version bigint;
  v_order bigint;
begin
  if p_action is null or p_action not in ('create', 'update', 'delete')
    or p_idempotency_key is null or p_expected_version is null
    or (p_action = 'create' and (p_id is not null or p_expected_version <> 0))
    or (p_action <> 'create' and (p_id is null or p_expected_version not between 1 and 9007199254740991))
    or (p_action = 'delete' and p_input is not null)
    or (p_action <> 'delete' and (
      jsonb_typeof(p_input) is distinct from 'object'
      or not (p_input ?| array['title', 'isDone', 'sortOrder'])
      or (p_action = 'create' and not (p_input ? 'title'))
      or (p_input ? 'title' and jsonb_typeof(p_input->'title') <> 'string')
      or (p_input ? 'isDone' and jsonb_typeof(p_input->'isDone') <> 'boolean')
      or (p_input ? 'sortOrder' and jsonb_typeof(p_input->'sortOrder') <> 'number')
    )) then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  -- Serialize retries sharing a receipt, and assign append order within the trip.
  perform pg_advisory_xact_lock(hashtextextended('checklist:receipt:' || p_trip_id::text || ':' || p_idempotency_key::text, 0));
  if not exists (select 1 from app_private.trips where id = p_trip_id) then
    raise exception using errcode = 'P0002', message = 'RESOURCE_NOT_FOUND';
  end if;
  select request into v_previous from app_private.shared_checklist_mutation_requests
    where trip_id = p_trip_id and idempotency_key = p_idempotency_key;
  if found then
    if v_previous is distinct from v_request then
      raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
    end if;
    return public.get_trip_shared_checklist(p_trip_id);
  end if;

  if p_action <> 'create' then
    select version into v_version from app_private.shared_checklist_items
      where trip_id = p_trip_id and id = p_id for update;
    if not found then
      raise exception using errcode = 'P0002', message = 'RESOURCE_NOT_FOUND';
    end if;
    if v_version <> p_expected_version then
      raise exception using errcode = 'P0001', message = 'VERSION_CONFLICT';
    end if;
  end if;

  v_order := (p_input->>'sortOrder')::bigint;
  if p_action = 'create' then
    if v_order is null then
      perform pg_advisory_xact_lock(hashtextextended('checklist:append:' || p_trip_id::text, 0));
      select least(coalesce(max(sort_order), -1) + 1, 9007199254740991) into v_order
        from app_private.shared_checklist_items where trip_id = p_trip_id;
    end if;
    insert into app_private.shared_checklist_items(trip_id, title, is_done, sort_order)
      values (p_trip_id, p_input->>'title', coalesce((p_input->>'isDone')::boolean, false), v_order);
  elsif p_action = 'update' then
    update app_private.shared_checklist_items
      set title = coalesce(p_input->>'title', title),
          is_done = coalesce((p_input->>'isDone')::boolean, is_done),
          sort_order = coalesce(v_order, sort_order),
          version = version + 1
      where trip_id = p_trip_id and id = p_id;
  else
    delete from app_private.shared_checklist_items where trip_id = p_trip_id and id = p_id;
  end if;

  insert into app_private.resource_versions(trip_id, resource_type, version)
    values (p_trip_id, 'checklists', 2)
    on conflict (trip_id, resource_type) do update
    set version = resource_versions.version + 1, updated_at = now();
  insert into app_private.shared_checklist_mutation_requests values (p_trip_id, p_idempotency_key, v_request);
  return public.get_trip_shared_checklist(p_trip_id);
exception
  when check_violation or not_null_violation or invalid_text_representation or numeric_value_out_of_range then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
end;
$$;

revoke all on function public.get_trip_shared_checklist(uuid) from public, anon, authenticated;
revoke all on function public.mutate_trip_shared_checklist(uuid, text, uuid, jsonb, bigint, uuid) from public, anon, authenticated;
grant execute on function public.get_trip_shared_checklist(uuid) to service_role;
grant execute on function public.mutate_trip_shared_checklist(uuid, text, uuid, jsonb, bigint, uuid) to service_role;
