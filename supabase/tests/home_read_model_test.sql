begin;

set local search_path = public, extensions, pg_catalog;

select plan(35);

select has_table('app_private', 'flights', 'flights table exists');
select has_table('app_private', 'travel_facts', 'travel facts table exists');
select has_column('app_private', 'trips', 'subtitle', 'trips include the home subtitle');
select has_column('app_private', 'trips', 'traveler_count', 'trips include the traveler count');
select ok(
  (
    select is_nullable = 'YES'
    from information_schema.columns
    where table_schema = 'app_private'
      and table_name = 'trips'
      and column_name = 'subtitle'
  ),
  'trip subtitle remains nullable'
);

select is(
  (select relrowsecurity from pg_class where oid = 'app_private.flights'::regclass),
  true,
  'flights have RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'app_private.travel_facts'::regclass),
  true,
  'travel facts have RLS enabled'
);
select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'app_private'
      and tablename = 'flights'
      and indexname = 'flights_trip_departure_idx'
  ),
  'flights have a trip timeline index'
);
select table_privs_are('app_private', 'flights', 'anon', array[]::text[], 'anon has no flight privileges');
select table_privs_are('app_private', 'travel_facts', 'authenticated', array[]::text[], 'authenticated has no travel fact privileges');
select has_function('public', 'get_trip_home', array['uuid'], 'home lookup function exists');
select function_privs_are('public', 'get_trip_home', array['uuid'], 'anon', array[]::text[], 'anon cannot execute home lookup');

select is(
  (select count(*)::integer from app_private.flights where trip_id = '11111111-1111-4111-8111-111111111111'),
  2,
  'primary trip has outbound and return flights'
);
select is(
  (select jsonb_agg(direction order by departure_at) from app_private.flights where trip_id = '11111111-1111-4111-8111-111111111111'),
  '["去程", "回程"]'::jsonb,
  'seeded flights preserve itinerary order'
);
select is(
  (select count(*)::integer from app_private.travel_facts where trip_id = '11111111-1111-4111-8111-111111111111'),
  4,
  'primary trip has four travel facts'
);
select is(
  (
    select jsonb_agg(title order by sort_order)
    from app_private.travel_facts
    where trip_id = '11111111-1111-4111-8111-111111111111'
  ),
  '["和台灣的時差", "參考匯率", "插座形狀", "自來水"]'::jsonb,
  'seeded travel facts match the approved order'
);
select is(
  (select version from app_private.resource_versions where trip_id = '11111111-1111-4111-8111-111111111111' and resource_type = 'home'),
  1::bigint,
  'primary trip has a home collection version'
);

select is(
  public.get_trip_home('11111111-1111-4111-8111-111111111111')->>'title',
  '2027 過年東歐遊',
  'home lookup returns the approved title'
);
select is(
  public.get_trip_home('11111111-1111-4111-8111-111111111111')->>'subtitle',
  '維也納・哈修塔特・布達佩斯',
  'home lookup returns the approved subtitle'
);
select is(
  (public.get_trip_home('11111111-1111-4111-8111-111111111111')->>'travelerCount')::integer,
  4,
  'home lookup returns the traveler count'
);
select is(
  (public.get_trip_home('11111111-1111-4111-8111-111111111111')->>'version')::bigint,
  1::bigint,
  'home lookup returns the collection version'
);
select is(
  jsonb_array_length(public.get_trip_home('11111111-1111-4111-8111-111111111111')->'flights'),
  2,
  'home lookup returns both flights'
);
select is(
  jsonb_array_length(public.get_trip_home('11111111-1111-4111-8111-111111111111')->'facts'),
  4,
  'home lookup returns all travel facts'
);
select is(
  public.get_trip_home('11111111-1111-4111-8111-111111111111')->'facts'->0->>'title',
  '和台灣的時差',
  'home lookup orders facts by sort order'
);
select ok(
  (
    select arrival_at > departure_at
    from app_private.flights
    where trip_id = '11111111-1111-4111-8111-111111111111' and direction = '回程'
  ),
  'return flight has an absolute cross-day timeline'
);
select ok(
  (
    select (arrival_at at time zone 'UTC')::date > (departure_at at time zone 'UTC')::date
    from app_private.flights
    where trip_id = '11111111-1111-4111-8111-111111111111' and direction = '回程'
  ),
  'return flight crosses a calendar day on its absolute timeline'
);

select throws_like(
  $$
    insert into app_private.flights (trip_id, direction, legs_json, departure_at, arrival_at)
    values (
      '11111111-1111-4111-8111-111111111111',
      '錯誤方向',
      '[{"airport":"TPE"},{"airport":"VIE"}]',
      '2027-02-05 00:20:00+08',
      '2027-02-05 12:25:00+01'
    )
  $$,
  '%flights_direction_supported%',
  'flights reject an unsupported direction'
);
select throws_like(
  $$
    insert into app_private.flights (trip_id, direction, legs_json, departure_at, arrival_at)
    values (
      '11111111-1111-4111-8111-111111111111',
      '去程',
      '[{"airport":"TPE"},{"airport":"VIE"}]',
      '2027-02-06 12:25:00+01',
      '2027-02-05 00:20:00+08'
    )
  $$,
  '%flights_timeline%',
  'flights reject a non-increasing timeline'
);
select throws_like(
  $$
    insert into app_private.travel_facts (trip_id, icon, title, content, sort_order)
    values ('11111111-1111-4111-8111-111111111111', 'unsupported', '測試', '測試內容', 10)
  $$,
  '%travel_facts_icon_supported%',
  'travel facts reject an unsupported icon'
);
select throws_like(
  $$
    insert into app_private.travel_facts (trip_id, icon, title, content, sort_order)
    values ('11111111-1111-4111-8111-111111111111', 'info', '測試', '測試內容', -1)
  $$,
  '%travel_facts_sort_order_nonnegative%',
  'travel facts reject a negative sort order'
);

select lives_ok(
  $$
    insert into app_private.trips (id, title, subtitle, traveler_count, start_date, end_date, display_timezone)
    values ('22222222-2222-4222-8222-222222222222', '隔離測試旅程', '不應出現在主要旅程', 2, '2027-03-01', '2027-03-02', 'Asia/Taipei');
    insert into app_private.resource_versions (trip_id, resource_type, version)
    values ('22222222-2222-4222-8222-222222222222', 'home', 3);
    insert into app_private.flights (trip_id, direction, legs_json, departure_at, arrival_at)
    values (
      '22222222-2222-4222-8222-222222222222',
      '去程',
      '[{"airport":"TPE"},{"airport":"KIX"}]',
      '2027-03-01 08:00:00+08',
      '2027-03-01 11:30:00+09'
    );
    insert into app_private.travel_facts (trip_id, icon, title, content, sort_order)
    values ('22222222-2222-4222-8222-222222222222', 'info', '隔離資料', '只屬於第二趟旅程', 0)
  $$,
  'a second trip can own an independent home collection'
);
select is(
  jsonb_array_length(public.get_trip_home('22222222-2222-4222-8222-222222222222')->'flights'),
  1,
  'home lookup returns only the requested trip flights'
);
select is(
  public.get_trip_home('22222222-2222-4222-8222-222222222222')->'facts'->0->>'title',
  '隔離資料',
  'home lookup returns only the requested trip facts'
);
select is(
  jsonb_array_length(public.get_trip_home('11111111-1111-4111-8111-111111111111')->'flights'),
  2,
  'a second trip does not change the primary trip result'
);
select is(
  public.get_trip_home('99999999-9999-4999-8999-999999999999'),
  null::jsonb,
  'home lookup returns null for an unknown trip'
);

select * from finish();
rollback;
