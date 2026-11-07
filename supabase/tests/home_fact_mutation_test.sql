begin;

set local search_path = public, extensions, pg_catalog;

select plan(15);

select has_table('app_private', 'home_fact_save_requests', 'home fact save request table exists');
select is(
  (select relrowsecurity from pg_class where oid = 'app_private.home_fact_save_requests'::regclass),
  true,
  'home fact save requests have RLS enabled'
);
select table_privs_are(
  'app_private',
  'home_fact_save_requests',
  'authenticated',
  array[]::text[],
  'authenticated has no home fact save request privileges'
);
select has_function(
  'public',
  'save_travel_facts',
  array['uuid', 'jsonb', 'bigint', 'uuid'],
  'home fact batch save function exists'
);
select function_privs_are(
  'public',
  'save_travel_facts',
  array['uuid', 'jsonb', 'bigint', 'uuid'],
  'anon',
  array[]::text[],
  'anon cannot execute home fact batch save'
);

select is(
  (public.save_travel_facts(
    '11111111-1111-4111-8111-111111111111',
    '[
      {"id":"50000000-0000-4000-8000-000000000002","icon":"exchange","title":"  更新匯率  ","content":"  1 EUR 約 34 TWD  ","sortOrder":0},
      {"id":"50000000-0000-4000-8000-000000000005","icon":"info","title":"交通票券","content":"上車前先確認是否需要打票","sortOrder":1}
    ]'::jsonb,
    1,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  )->>'version')::bigint,
  2::bigint,
  'batch save increments the home collection version'
);
select is(
  jsonb_array_length(public.get_trip_home('11111111-1111-4111-8111-111111111111')->'facts'),
  2,
  'batch save deletes omitted facts and inserts new facts'
);
select is(
  public.get_trip_home('11111111-1111-4111-8111-111111111111')->'facts'->0->>'title',
  '更新匯率',
  'batch save trims content and preserves requested ordering'
);
select is(
  public.get_trip_home('11111111-1111-4111-8111-111111111111')->'facts'->1->>'title',
  '交通票券',
  'batch save inserts the second ordered fact'
);
select is(
  (public.save_travel_facts(
    '11111111-1111-4111-8111-111111111111',
    '[
      {"id":"50000000-0000-4000-8000-000000000002","icon":"exchange","title":"更新匯率","content":"1 EUR 約 34 TWD","sortOrder":0},
      {"id":"50000000-0000-4000-8000-000000000005","icon":"info","title":"交通票券","content":"上車前先確認是否需要打票","sortOrder":1}
    ]'::jsonb,
    1,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  )->>'version')::bigint,
  2::bigint,
  'idempotent retry replays the saved response'
);
select is(
  (select version from app_private.resource_versions where trip_id = '11111111-1111-4111-8111-111111111111' and resource_type = 'home'),
  2::bigint,
  'idempotent retry does not increment the version again'
);

select throws_ok(
  $$
    select public.save_travel_facts(
      '11111111-1111-4111-8111-111111111111',
      '[{"id":"50000000-0000-4000-8000-000000000006","icon":"info","title":"過期裝置內容","content":"不得覆蓋新資料","sortOrder":0}]'::jsonb,
      1,
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    )
  $$,
  'P0001',
  'VERSION_CONFLICT',
  'a second device cannot save the same stale home version'
);
select is(
  (select version from app_private.resource_versions where trip_id = '11111111-1111-4111-8111-111111111111' and resource_type = 'home'),
  2::bigint,
  'version conflict leaves the home version unchanged'
);
select is(
  public.get_trip_home('11111111-1111-4111-8111-111111111111')->'facts'->0->>'title',
  '更新匯率',
  'version conflict leaves the saved fact batch unchanged'
);
select throws_ok(
  $$
    select public.save_travel_facts(
      '11111111-1111-4111-8111-111111111111',
      '{}'::jsonb,
      2,
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    )
  $$,
  '22023',
  'VALIDATION_FAILED',
  'batch save rejects a non-array payload'
);

select * from finish();
rollback;
