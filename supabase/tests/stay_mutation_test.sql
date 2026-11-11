begin;
set local search_path = public, extensions, pg_catalog;
select plan(18);
create temporary table stay_test_input as select
  '{"name":"交易測試住宿","city":"維也納","address":"測試地址","startDate":"2027-02-06","endDate":"2027-02-08","checkin":"15:00","checkout":"11:00","photo":null}'::jsonb as input;
create temporary table stay_test_saved as select public.mutate_trip_stay(
  '11111111-1111-4111-8111-111111111111', 'create', null,
  (select input from stay_test_input), 0, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') as response;
select is((select response->'stays'->0->>'name' from stay_test_saved), '交易測試住宿', 'create persists');
select is((select (response->'stays'->0->>'version')::int from stay_test_saved), 1, 'create starts version 1');
select is(public.mutate_trip_stay('11111111-1111-4111-8111-111111111111', 'create', null,
  (select input from stay_test_input), 0, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  (select response from stay_test_saved), 'retry replays response');
select is((select count(*)::int from app_private.stays where name = '交易測試住宿'), 1, 'retry does not duplicate');
select throws_ok($$select public.mutate_trip_stay('11111111-1111-4111-8111-111111111111', 'create', null,
  (select input || '{"name":"不同請求"}'::jsonb from stay_test_input), 0, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,
  '22023', 'VALIDATION_FAILED', 'key reuse with different input rejected');
select is((public.mutate_trip_stay('11111111-1111-4111-8111-111111111111', 'update',
  (select (response->'stays'->0->>'id')::uuid from stay_test_saved),
  (select input || '{"name":"已更新住宿"}'::jsonb from stay_test_input), 1,
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')->'stays'->0->>'version')::int, 2, 'update increments resource version');
select throws_ok($$select public.mutate_trip_stay('11111111-1111-4111-8111-111111111111', 'update',
  (select (response->'stays'->0->>'id')::uuid from stay_test_saved),
  (select input from stay_test_input), 1, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')$$,
  'P0001', 'VERSION_CONFLICT', 'stale update rejected');
select throws_ok($$select public.mutate_trip_stay('11111111-1111-4111-8111-111111111111', 'delete',
  (select (response->'stays'->0->>'id')::uuid from stay_test_saved),
  null, 1, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')$$,
  'P0001', 'VERSION_CONFLICT', 'stale delete rejected');
select throws_ok($$select public.mutate_trip_stay('11111111-1111-4111-8111-111111111111', 'create', null,
  (select input || '{"endDate":"2027-02-05"}'::jsonb from stay_test_input), 0,
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd')$$, '22023', 'VALIDATION_FAILED', 'invalid date order rejected');
select throws_ok($$select public.mutate_trip_stay('11111111-1111-4111-8111-111111111111', 'create', null,
  (select input || '{"startDate":"2027-02-04"}'::jsonb from stay_test_input), 0,
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd')$$, '22023', 'VALIDATION_FAILED', 'outside trip rejected');
select throws_ok($$select public.mutate_trip_stay('11111111-1111-4111-8111-111111111111', 'create', null,
  (select input || '{"checkin":"25:00"}'::jsonb from stay_test_input), 0,
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd')$$, '22023', 'VALIDATION_FAILED', 'invalid time rejected');
insert into app_private.trips(id, title, subtitle, traveler_count, start_date, end_date, display_timezone)
values ('22222222-2222-4222-8222-222222222222', '測試旅程', '測試', 4, '2027-02-05', '2027-02-15', 'Europe/Vienna');
insert into app_private.resource_versions(trip_id, resource_type, version)
values ('22222222-2222-4222-8222-222222222222', 'stays', 1);
select throws_ok($$select public.mutate_trip_stay('22222222-2222-4222-8222-222222222222', 'delete',
  (select (response->'stays'->0->>'id')::uuid from stay_test_saved),
  null, 2, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd')$$,
  'P0002', 'RESOURCE_NOT_FOUND', 'cross trip deletion rejected');
select is((select version::int from app_private.stays where id = (select (response->'stays'->0->>'id')::uuid from stay_test_saved)), 2, 'failed writes leave data unchanged');
select is(public.mutate_trip_stay('11111111-1111-4111-8111-111111111111', 'delete',
  (select (response->'stays'->0->>'id')::uuid from stay_test_saved), null, 2,
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')->'stays', '[]'::jsonb, 'delete succeeds');
select is(public.mutate_trip_stay('11111111-1111-4111-8111-111111111111', 'delete',
  (select (response->'stays'->0->>'id')::uuid from stay_test_saved), null, 2,
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')->'stays', '[]'::jsonb, 'delete retry succeeds');
select is((select count(*)::int from app_private.stays where name = '已更新住宿'), 0, 'deleted row absent');
select function_privs_are('public', 'mutate_trip_stay', array['uuid','text','uuid','jsonb','bigint','uuid'], 'anon', array[]::text[], 'anon cannot execute mutation');
select table_privs_are('app_private', 'stay_mutation_requests', 'authenticated', array[]::text[], 'browser cannot read idempotency records');
select * from finish();
rollback;
