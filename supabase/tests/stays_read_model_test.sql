begin;
set local search_path = public, extensions, pg_catalog;
select plan(12);
select has_table('app_private', 'stays', 'stays table exists');
select is((select relrowsecurity from pg_class where oid = 'app_private.stays'::regclass), true);
select table_privs_are('app_private', 'stays', 'anon', array[]::text[]);
select function_privs_are('public', 'get_trip_stays', array['uuid'], 'authenticated', array[]::text[]);
select is(jsonb_array_length(public.get_trip_stays('11111111-1111-4111-8111-111111111111')->'stays'), 2);
select is(public.get_trip_stays('11111111-1111-4111-8111-111111111111')->'stays'->0->>'startDate', '2027-02-05');
select is(public.get_trip_stays('99999999-9999-4999-8999-999999999999'), null::jsonb);
select throws_ok($$
  update app_private.stays set end_date = start_date
  where id = '60000000-0000-4000-8000-000000000001'
$$, '23514', null, 'reject equal dates');
select throws_ok($$
  update app_private.stays set start_date = '2027-02-04'
  where id = '60000000-0000-4000-8000-000000000001'
$$, '23514', 'stays_trip_date_range', 'reject outside trip');
select throws_ok($$
  update app_private.stays set place_id = '99999999-9999-4999-8999-999999999999'
  where id = '60000000-0000-4000-8000-000000000001'
$$, '23503', null, 'reject missing place');
select throws_ok($$
  update app_private.stays set photo_resource_name = 'places/example/photos/photo'
  where id = '60000000-0000-4000-8000-000000000001'
$$, '23514', 'stays_photo_source', 'reject photo without confirmed place');
insert into app_private.trips(id, title, subtitle, traveler_count, start_date, end_date, display_timezone)
values ('22222222-2222-4222-8222-222222222222', '隔離測試', '測試副標', 4, '2027-02-05', '2027-02-15', 'Europe/Vienna');
select is(jsonb_array_length(public.get_trip_stays('22222222-2222-4222-8222-222222222222')->'stays'), 0, 'other trip cannot read primary stays');
select * from finish();
rollback;
