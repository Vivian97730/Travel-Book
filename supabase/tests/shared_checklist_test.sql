begin;
set local search_path = public, extensions, pg_catalog;
select plan(2);
set local plpgsql.check_asserts = on;

insert into app_private.trips (id, title, start_date, end_date, display_timezone, traveler_count)
values
  ('c1000000-0000-4000-8000-000000000001', 'Checklist test A', '2027-02-05', '2027-02-15', 'Asia/Taipei', 4),
  ('c2000000-0000-4000-8000-000000000001', 'Checklist test B', '2027-02-05', '2027-02-15', 'Asia/Taipei', 4);

do $$
declare
  client_role text;
begin
  foreach client_role in array array['anon', 'authenticated'] loop
    assert not has_table_privilege(client_role, 'app_private.shared_checklist_items', 'SELECT, INSERT, UPDATE, DELETE');
    assert not has_table_privilege(client_role, 'app_private.shared_checklist_mutation_requests', 'SELECT, INSERT, UPDATE, DELETE');
    assert not has_function_privilege(client_role, 'public.get_trip_shared_checklist(uuid)', 'EXECUTE');
    assert not has_function_privilege(client_role, 'public.mutate_trip_shared_checklist(uuid,text,uuid,jsonb,bigint,uuid)', 'EXECUTE');
  end loop;
  assert (select relrowsecurity and relforcerowsecurity from pg_class
    where oid = 'app_private.shared_checklist_items'::regclass);
  assert (select relrowsecurity and relforcerowsecurity from pg_class
    where oid = 'app_private.shared_checklist_mutation_requests'::regclass);
end $$;

select pass('Shared checklist tables and RPCs are private');

set local role service_role;
do $$
declare
  trip constant uuid := 'c1000000-0000-4000-8000-000000000001';
  other_trip constant uuid := 'c2000000-0000-4000-8000-000000000001';
  empty_list constant jsonb := '{"schemaVersion":1,"version":1,"items":[]}';
  create_key uuid := gen_random_uuid();
  toggle_key uuid := gen_random_uuid();
  delete_key uuid := gen_random_uuid();
  item_id uuid;
  result jsonb;
begin
  assert public.get_trip_shared_checklist(trip) = empty_list;
  assert public.get_trip_shared_checklist(gen_random_uuid()) is null;

  result := public.mutate_trip_shared_checklist(trip, 'create', null, '{"title":"護照"}', 0, create_key);
  item_id := (result#>>'{items,0,id}')::uuid;
  assert item_id is not null;
  assert result#>'{items,0}' = jsonb_build_object(
    'id', item_id, 'title', '護照', 'isDone', false, 'sortOrder', 0, 'version', 1);
  assert result->>'version' = '2';
  assert public.get_trip_shared_checklist(trip) = result, 'a fresh read sees the other client write';
  assert public.get_trip_shared_checklist(other_trip) = empty_list;
  assert public.mutate_trip_shared_checklist(trip, 'create', null, '{"title":"護照"}', 0, create_key) = result;
  begin
    perform public.mutate_trip_shared_checklist(trip, 'create', null, '{"title":"不同項目"}', 0, create_key);
    assert false, 'a different request cannot reuse a receipt';
  exception when invalid_parameter_value then null;
  end;

  result := public.mutate_trip_shared_checklist(trip, 'create', null, '{"title":"轉接頭"}', 0, gen_random_uuid());
  assert result#>>'{items,1,title}' = '轉接頭';
  assert result#>>'{items,1,sortOrder}' = '1';

  result := public.mutate_trip_shared_checklist(trip, 'update', item_id, '{"isDone":true}', 1, toggle_key);
  assert result#>>'{items,0,isDone}' = 'true';
  assert result#>>'{items,0,title}' = '護照';
  assert result#>>'{items,0,version}' = '2';
  assert public.mutate_trip_shared_checklist(trip, 'update', item_id, '{"isDone":true}', 1, toggle_key) = result;

  result := public.mutate_trip_shared_checklist(trip, 'update', item_id, '{"title":"備用護照","sortOrder":2}', 2, gen_random_uuid());
  assert result#>>'{items,1,title}' = '備用護照';
  assert result#>>'{items,1,isDone}' = 'true';
  assert result#>>'{items,1,version}' = '3';
  begin
    perform public.mutate_trip_shared_checklist(trip, 'update', item_id, '{"isDone":false}', 2, gen_random_uuid());
    assert false, 'a stale update cannot overwrite';
  exception when raise_exception then assert sqlerrm = 'VERSION_CONFLICT';
  end;
  begin
    perform public.mutate_trip_shared_checklist(trip, 'delete', item_id, null, 2, gen_random_uuid());
    assert false, 'a stale delete cannot remove the item';
  exception when raise_exception then assert sqlerrm = 'VERSION_CONFLICT';
  end;
  begin
    perform public.mutate_trip_shared_checklist(other_trip, 'update', item_id, '{"isDone":false}', 3, gen_random_uuid());
    assert false, 'another trip cannot edit the item';
  exception when no_data_found then assert sqlerrm = 'RESOURCE_NOT_FOUND';
  end;
  begin
    perform public.mutate_trip_shared_checklist(other_trip, 'delete', item_id, null, 3, gen_random_uuid());
    assert false, 'another trip cannot delete the item';
  exception when no_data_found then assert sqlerrm = 'RESOURCE_NOT_FOUND';
  end;
  begin
    perform public.mutate_trip_shared_checklist(trip, 'update', item_id, '{"title":"   "}', 3, gen_random_uuid());
    assert false, 'database rejects a blank title';
  exception when invalid_parameter_value then null;
  end;
  assert public.get_trip_shared_checklist(trip) = result, 'failed writes leave data and version unchanged';

  result := public.mutate_trip_shared_checklist(trip, 'delete', item_id, null, 3, delete_key);
  assert jsonb_array_length(result->'items') = 1;
  assert result->>'version' = '6';
  assert public.mutate_trip_shared_checklist(trip, 'delete', item_id, null, 3, delete_key) = result;
  assert public.get_trip_shared_checklist(trip) = result;
  assert public.get_trip_shared_checklist(other_trip) = empty_list;
end $$;

reset role;
select pass('Shared checklist CRUD, ordering, isolation, conflicts and retries passed');
select * from finish();
rollback;
