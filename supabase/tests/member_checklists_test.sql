begin;
set local search_path = public, extensions, pg_catalog;
set local plpgsql.check_asserts = on;
-- Plain transaction assertions also run in isolated PostgreSQL without pgTAP.
insert into app_private.trips(id, title, start_date, end_date, display_timezone, traveler_count)
values ('d1000000-0000-4000-8000-000000000001', 'Member A', '2027-02-05', '2027-02-15', 'Asia/Taipei', 4),
('d2000000-0000-4000-8000-000000000001', 'Member B', '2027-02-05', '2027-02-15', 'Asia/Taipei', 4);
do $$
declare client_role text; table_name text;
begin
  foreach client_role in array array['anon','authenticated'] loop
    foreach table_name in array array['trip_members','personal_checklist_items','personal_checklist_mutation_requests'] loop
      assert not has_table_privilege(client_role, 'app_private.' || table_name, 'SELECT, INSERT, UPDATE, DELETE');
      assert (select relrowsecurity and relforcerowsecurity from pg_class where oid = ('app_private.' || table_name)::regclass);
    end loop;
    assert not has_function_privilege(client_role, 'public.get_trip_members(uuid)', 'EXECUTE');
    assert not has_function_privilege(client_role, 'public.get_trip_personal_checklist(uuid,uuid,text)', 'EXECUTE');
    assert not has_function_privilege(client_role, 'public.mutate_trip_personal_checklist(uuid,uuid,text,text,uuid,jsonb,bigint,uuid)', 'EXECUTE');
  end loop;
end $$;
set local role service_role;
do $$
declare
  trip uuid := 'd1000000-0000-4000-8000-000000000001';
  other_trip uuid := 'd2000000-0000-4000-8000-000000000001';
  mother uuid; father uuid; other_member uuid; item uuid;
  receipt uuid := gen_random_uuid(); result jsonb;
begin
  assert jsonb_array_length(public.get_trip_members(trip)) = 4;
  mother := (public.get_trip_members(trip)#>>'{1,id}')::uuid;
  father := (public.get_trip_members(trip)#>>'{0,id}')::uuid;
  other_member := (public.get_trip_members(other_trip)#>>'{1,id}')::uuid;
  assert mother <> father and mother <> other_member;
  assert public.get_trip_members(trip)#>>'{1,id}' = mother::text;
  result := public.mutate_trip_personal_checklist(trip, mother, 'luggage', 'create', null, '{"title":"護照","isDone":true}', 0, receipt);
  item := (result#>>'{items,0,id}')::uuid;
  assert public.get_trip_personal_checklist(trip, mother, 'luggage') = result;
  assert public.mutate_trip_personal_checklist(trip, mother, 'luggage', 'create', null, '{"title":"護照","isDone":true}', 0, receipt) = result;
  assert public.get_trip_personal_checklist(trip, father, 'luggage')->'items' = '[]'::jsonb;
  assert public.get_trip_personal_checklist(trip, mother, 'todos')->'items' = '[]'::jsonb;
  assert public.get_trip_personal_checklist(other_trip, other_member, 'luggage')->'items' = '[]'::jsonb;
  assert public.get_trip_personal_checklist(other_trip, mother, 'luggage') is null;
  begin
    perform public.mutate_trip_personal_checklist(other_trip, mother, 'luggage', 'create', null, '{"title":"錯誤"}', 0, gen_random_uuid());
    assert false;
  exception when no_data_found then null; end;
  begin
    perform public.mutate_trip_personal_checklist(trip, father, 'luggage', 'delete', item, null, 1, gen_random_uuid());
    assert false;
  exception when no_data_found then null; end;
  result := public.mutate_trip_personal_checklist(trip, mother, 'luggage', 'update', item, '{"title":"新護照"}', 1, gen_random_uuid());
  assert result#>>'{items,0,version}' = '2';
  begin
    perform public.mutate_trip_personal_checklist(trip, mother, 'luggage', 'update', item, '{"isDone":false}', 1, gen_random_uuid());
    assert false;
  exception when raise_exception then assert sqlerrm = 'VERSION_CONFLICT'; end;
  assert public.get_trip_shared_checklist(trip)->'items' = '[]'::jsonb;
  perform public.mutate_trip_personal_checklist(trip, mother, 'luggage', 'delete', item, null, 2, gen_random_uuid());
  assert public.get_trip_personal_checklist(trip, mother, 'luggage')->'items' = '[]'::jsonb;
end $$;
-- TAP output keeps these transaction assertions compatible with supabase test db.
select '1..1' as tap;
select 'ok 1 - Member checklist isolation, versions, retries and permissions passed' as tap;
rollback;
