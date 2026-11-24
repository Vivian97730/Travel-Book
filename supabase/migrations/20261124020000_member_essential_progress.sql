-- Shared definitions, independent completion. Legacy shared is_done is preserved,
-- but never attributed to members whose identities were not recorded.
alter table app_private.shared_checklist_items add constraint shared_checklist_trip_id_id_key unique (trip_id, id);
create table app_private.member_essential_progress (
  trip_id uuid not null,
  member_id uuid not null,
  item_id uuid not null,
  is_done boolean not null default false,
  version bigint not null default 1 check (version between 1 and 9007199254740991),
  primary key (trip_id, member_id, item_id),
  foreign key (trip_id, member_id) references app_private.trip_members(trip_id, id) on delete cascade,
  foreign key (trip_id, item_id) references app_private.shared_checklist_items(trip_id, id) on delete cascade
);
create table app_private.member_essential_requests (
  trip_id uuid not null,
  member_id uuid not null,
  idempotency_key uuid not null,
  request jsonb not null,
  primary key (trip_id, member_id, idempotency_key),
  foreign key (trip_id, member_id) references app_private.trip_members(trip_id, id) on delete cascade
);
alter table app_private.member_essential_progress enable row level security;
alter table app_private.member_essential_progress force row level security;
alter table app_private.member_essential_requests enable row level security;
alter table app_private.member_essential_requests force row level security;
revoke all on app_private.member_essential_progress, app_private.member_essential_requests from public, anon, authenticated;

create function public.get_trip_member_essentials(p_trip_id uuid, p_member_id uuid)
returns jsonb language sql stable security definer set search_path = pg_catalog, app_private as $$
  select jsonb_build_object('schemaVersion', 1, 'version',
    coalesce((select version from app_private.resource_versions where trip_id = p_trip_id and resource_type = 'checklists'), 1)
      + (select count(*) from app_private.member_essential_requests where trip_id = p_trip_id and member_id = p_member_id),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', i.id, 'title', i.title, 'sortOrder', i.sort_order,
      'isDone', coalesce(p.is_done, false), 'version', i.version + coalesce(p.version, 1) - 1
    ) order by i.sort_order, i.id)
    from app_private.shared_checklist_items i left join app_private.member_essential_progress p
      on p.trip_id = i.trip_id and p.item_id = i.id and p.member_id = p_member_id
    where i.trip_id = p_trip_id), '[]'::jsonb))
  from app_private.trip_members where trip_id = p_trip_id and id = p_member_id;
$$;

create function public.mutate_trip_member_essentials(
  p_trip_id uuid, p_member_id uuid, p_action text, p_id uuid, p_input jsonb,
  p_expected_version bigint, p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = pg_catalog, app_private as $$
declare
  v_request jsonb := jsonb_build_array(p_action, p_id, p_input, p_expected_version);
  v_previous jsonb;
  v_shared_version bigint;
  v_progress_version bigint;
  v_created uuid;
  v_order bigint;
  v_definition_key uuid := md5(p_member_id::text || ':' || p_idempotency_key::text)::uuid;
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
    )) then raise exception using errcode = '22023', message = 'VALIDATION_FAILED'; end if;
  if not exists (select 1 from app_private.trip_members where trip_id = p_trip_id and id = p_member_id) then
    raise exception using errcode = 'P0002', message = 'RESOURCE_NOT_FOUND';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('essentials:receipt:' || p_trip_id::text || ':' || p_member_id::text || ':' || p_idempotency_key::text, 0));
  select request into v_previous from app_private.member_essential_requests
    where trip_id = p_trip_id and member_id = p_member_id and idempotency_key = p_idempotency_key;
  if found then
    if v_previous is distinct from v_request then
      raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
    end if;
    return public.get_trip_member_essentials(p_trip_id, p_member_id);
  end if;
  if p_action <> 'create' then
    -- Definition row serializes edits/deletes and concurrent member toggles.
    select version into v_shared_version from app_private.shared_checklist_items
      where trip_id = p_trip_id and id = p_id for update;
    if not found then raise exception using errcode = 'P0002', message = 'RESOURCE_NOT_FOUND'; end if;
    select version into v_progress_version from app_private.member_essential_progress
      where trip_id = p_trip_id and member_id = p_member_id and item_id = p_id;
    if v_shared_version + coalesce(v_progress_version, 1) - 1 <> p_expected_version then
      raise exception using errcode = 'P0001', message = 'VERSION_CONFLICT';
    end if;
  end if;
  if p_action = 'create' then
    perform pg_advisory_xact_lock(hashtextextended('checklist:append:' || p_trip_id::text, 0));
    v_order := (p_input->>'sortOrder')::bigint;
    if v_order is null then
      select least(coalesce(max(sort_order), -1) + 1, 9007199254740991) into v_order
        from app_private.shared_checklist_items where trip_id = p_trip_id;
    end if;
    insert into app_private.shared_checklist_items(trip_id, title, sort_order)
      values (p_trip_id, p_input->>'title', v_order) returning id into v_created;
    if coalesce((p_input->>'isDone')::boolean, false) then
      insert into app_private.member_essential_progress(trip_id, member_id, item_id, is_done, version)
        values (p_trip_id, p_member_id, v_created, true, 2);
    end if;
    insert into app_private.resource_versions(trip_id, resource_type, version)
      values (p_trip_id, 'checklists', 2) on conflict (trip_id, resource_type) do update
      set version = resource_versions.version + 1, updated_at = now();
  else
    if p_action = 'delete' or p_input ?| array['title', 'sortOrder'] then
      perform public.mutate_trip_shared_checklist(p_trip_id, p_action, p_id,
        case when p_action = 'delete' then null else p_input - 'isDone' end,
        v_shared_version, v_definition_key);
    end if;
    if p_action = 'update' and p_input ? 'isDone' then
      insert into app_private.member_essential_progress(trip_id, member_id, item_id, is_done, version)
        values (p_trip_id, p_member_id, p_id, (p_input->>'isDone')::boolean, 2)
        on conflict (trip_id, member_id, item_id) do update
          set is_done = excluded.is_done, version = member_essential_progress.version + 1;
    end if;
  end if;
  insert into app_private.member_essential_requests values (p_trip_id, p_member_id, p_idempotency_key, v_request);
  return public.get_trip_member_essentials(p_trip_id, p_member_id);
exception when check_violation or not_null_violation or invalid_text_representation or numeric_value_out_of_range then
  raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
end;
$$;
revoke all on function public.get_trip_member_essentials(uuid, uuid) from public, anon, authenticated;
revoke all on function public.mutate_trip_member_essentials(uuid, uuid, text, uuid, jsonb, bigint, uuid) from public, anon, authenticated;
grant execute on function public.get_trip_member_essentials(uuid, uuid) to service_role;
grant execute on function public.mutate_trip_member_essentials(uuid, uuid, text, uuid, jsonb, bigint, uuid) to service_role;
