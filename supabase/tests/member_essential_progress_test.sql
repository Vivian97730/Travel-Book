begin;
set local plpgsql.check_asserts = on;
insert into app_private.trips(id,title,traveler_count,start_date,end_date,display_timezone)
values ('e1000000-0000-4000-8000-000000000001','Synthetic',4,'2027-02-05','2027-02-15','Asia/Taipei'),
('e2000000-0000-4000-8000-000000000001','Other synthetic',4,'2027-02-05','2027-02-15','Asia/Taipei');
do $$
declare r text; t text;
begin
  foreach r in array array['anon','authenticated'] loop
    foreach t in array array['member_essential_progress','member_essential_requests'] loop
      assert not has_table_privilege(r,'app_private.'||t,'SELECT, INSERT, UPDATE, DELETE');
      assert (select relrowsecurity and relforcerowsecurity from pg_class where oid=('app_private.'||t)::regclass);
    end loop;
    assert not has_function_privilege(r,'public.get_trip_member_essentials(uuid,uuid)','EXECUTE');
    assert not has_function_privilege(r,'public.mutate_trip_member_essentials(uuid,uuid,text,uuid,jsonb,bigint,uuid)','EXECUTE');
  end loop;
end $$;
set local role service_role;
do $$
declare
  trip uuid := 'e1000000-0000-4000-8000-000000000001';
  other_trip uuid := 'e2000000-0000-4000-8000-000000000001';
  mother uuid; father uuid; member jsonb; item uuid; receipt uuid := gen_random_uuid(); result jsonb; before_father jsonb;
begin
  mother := (public.get_trip_members(trip)#>>'{1,id}')::uuid;
  father := (public.get_trip_members(trip)#>>'{0,id}')::uuid;
  -- Legacy shared completion is deliberately not assigned to anyone.
  result := public.mutate_trip_shared_checklist(trip,'create',null,'{"title":"護照","isDone":true}',0,gen_random_uuid());
  item := (result#>>'{items,0,id}')::uuid;
  for member in select value from jsonb_array_elements(public.get_trip_members(trip)) loop
    assert public.get_trip_member_essentials(trip,(member->>'id')::uuid)#>>'{items,0,isDone}' = 'false';
  end loop;
  before_father := public.get_trip_member_essentials(trip,father);
  result := public.mutate_trip_member_essentials(trip,mother,'update',item,'{"isDone":true}',1,receipt);
  assert result#>>'{items,0,isDone}' = 'true';
  assert public.get_trip_member_essentials(trip,father) = before_father;
  assert public.mutate_trip_member_essentials(trip,mother,'update',item,'{"isDone":true}',1,receipt) = result;
  begin
    perform public.mutate_trip_member_essentials(trip,mother,'update',item,'{"isDone":false}',1,gen_random_uuid());
    assert false, 'stale version accepted';
  exception when raise_exception then assert sqlerrm = 'VERSION_CONFLICT'; end;
  begin
    perform public.mutate_trip_member_essentials(trip,mother,'update',item,'{"isDone":false}',2,receipt);
    assert false, 'changed retry accepted';
  exception when invalid_parameter_value then null; end;
  -- Another role still uses its original version despite mother's completion.
  result := public.mutate_trip_member_essentials(trip,father,'update',item,'{"title":"共用護照"}',1,receipt);
  assert result#>>'{items,0,isDone}' = 'false';
  assert public.get_trip_member_essentials(trip,mother)#>>'{items,0,title}' = '共用護照';
  assert public.get_trip_member_essentials(trip,mother)#>>'{items,0,isDone}' = 'true';
  assert public.get_trip_member_essentials(other_trip,mother) is null;
  begin
    perform public.mutate_trip_member_essentials(other_trip,mother,'update',item,'{"isDone":true}',1,gen_random_uuid());
    assert false, 'cross trip accepted';
  exception when no_data_found then null; end;
  result := public.mutate_trip_member_essentials(trip,mother,'create',null,'{"title":"保險","isDone":true}',0,gen_random_uuid());
  assert result#>>'{items,1,isDone}' = 'true';
  assert public.get_trip_member_essentials(trip,father)#>>'{items,1,isDone}' = 'false';
  result := public.mutate_trip_member_essentials(trip,mother,'update',item,'{"isDone":false}',3,gen_random_uuid());
  assert result#>>'{items,0,isDone}' = 'false';
  perform public.mutate_trip_member_essentials(trip,father,'delete',item,null,2,gen_random_uuid());
  assert jsonb_array_length(public.get_trip_member_essentials(trip,mother)->'items') = 1;
end $$;
reset role;
do $$ begin assert not exists (select 1 from app_private.member_essential_progress p left join app_private.shared_checklist_items i on i.id=p.item_id where i.id is null); end $$;
select '1..1' as tap;
select 'ok 1 - Essential member progress, shared definitions, retries, versions and permissions passed' as tap;
rollback;
