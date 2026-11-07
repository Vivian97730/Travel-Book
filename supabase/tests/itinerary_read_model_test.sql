begin;

set local search_path = public, extensions, pg_catalog;

select plan(24);

select has_table('app_private', 'places', 'places table exists');
select has_table('app_private', 'trip_days', 'trip days table exists');
select has_table('app_private', 'itinerary_items', 'itinerary items table exists');
select is((select relrowsecurity from pg_class where oid = 'app_private.places'::regclass), true, 'places has RLS enabled');
select is((select relrowsecurity from pg_class where oid = 'app_private.trip_days'::regclass), true, 'trip days has RLS enabled');
select is((select relrowsecurity from pg_class where oid = 'app_private.itinerary_items'::regclass), true, 'itinerary items has RLS enabled');
select table_privs_are('app_private', 'trip_days', 'anon', array[]::text[], 'anon has no trip day privileges');
select table_privs_are('app_private', 'itinerary_items', 'authenticated', array[]::text[], 'authenticated has no itinerary item privileges');
select function_privs_are('public', 'get_trip_day', array['uuid', 'date'], 'anon', array[]::text[], 'anon cannot execute itinerary lookup');
select is((public.get_trip_day('11111111-1111-4111-8111-111111111111', '2027-02-06')->>'city'), '維也納', 'lookup returns the scoped city');
select is(jsonb_array_length(public.get_trip_day('11111111-1111-4111-8111-111111111111', '2027-02-06')->'items'), 4, 'lookup returns all ordered items');
select is((public.get_trip_day('11111111-1111-4111-8111-111111111111', '2027-02-06')->'items'->0->>'sortOrder')::integer, 0, 'lookup preserves item ordering');
select is(public.get_trip_day('11111111-1111-4111-8111-111111111111', '2027-02-20'), null::jsonb, 'lookup returns null for a missing day');

select has_function(
  'public',
  'save_trip_day_items',
  array['uuid', 'date', 'jsonb', 'bigint', 'uuid'],
  'itinerary batch save function exists'
);
select function_privs_are(
  'public',
  'save_trip_day_items',
  array['uuid', 'date', 'jsonb', 'bigint', 'uuid'],
  'anon',
  array[]::text[],
  'anon cannot execute itinerary batch save'
);
select is(
  (public.save_trip_day_items(
    '11111111-1111-4111-8111-111111111111',
    '2027-02-06',
    '[
      {"id":"20000000-0000-4000-8000-000000000003","title":"中央咖啡館早午餐","note":"已完成訂位","category":"food","sortOrder":0},
      {"id":"20000000-0000-4000-8000-000000000005","title":"晚間音樂會","note":"提前三十分鐘入場","category":"sight","sortOrder":1}
    ]'::jsonb,
    1,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  )->>'version')::bigint,
  2::bigint,
  'batch save increments the day version'
);
select is(
  jsonb_array_length(public.get_trip_day('11111111-1111-4111-8111-111111111111', '2027-02-06')->'items'),
  2,
  'batch save deletes omitted items and inserts new items'
);
select is(
  public.get_trip_day('11111111-1111-4111-8111-111111111111', '2027-02-06')->'items'->0->>'title',
  '中央咖啡館早午餐',
  'batch save updates item content and ordering'
);
select is(
  public.get_trip_day('11111111-1111-4111-8111-111111111111', '2027-02-06')->'items'->0->'place'->>'id',
  '30000000-0000-4000-8000-000000000002',
  'batch save preserves the retained item place'
);
select is(
  (public.save_trip_day_items(
    '11111111-1111-4111-8111-111111111111',
    '2027-02-06',
    '[
      {"id":"20000000-0000-4000-8000-000000000003","title":"中央咖啡館早午餐","note":"已完成訂位","category":"food","sortOrder":0},
      {"id":"20000000-0000-4000-8000-000000000005","title":"晚間音樂會","note":"提前三十分鐘入場","category":"sight","sortOrder":1}
    ]'::jsonb,
    1,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  )->>'version')::bigint,
  2::bigint,
  'idempotent retry replays the saved response'
);
select is(
  (select version from app_private.trip_days where id = '10000000-0000-4000-8000-000000000002'),
  2::bigint,
  'idempotent retry does not increment the version again'
);

select throws_ok(
  $$
    select public.save_trip_day_items(
      '11111111-1111-4111-8111-111111111111',
      '2027-02-06',
      '[{"id":"20000000-0000-4000-8000-000000000006","title":"過期裝置內容","note":"不得覆蓋新資料","category":"sight","sortOrder":0}]'::jsonb,
      1,
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    )
  $$,
  'P0001',
  'VERSION_CONFLICT',
  'a second device cannot save the same stale version'
);
select is(
  (select version from app_private.trip_days where id = '10000000-0000-4000-8000-000000000002'),
  2::bigint,
  'version conflict leaves the saved version unchanged'
);
select is(
  public.get_trip_day('11111111-1111-4111-8111-111111111111', '2027-02-06')->'items'->0->>'title',
  '中央咖啡館早午餐',
  'version conflict leaves the previously saved item batch unchanged'
);

select * from finish();
rollback;
