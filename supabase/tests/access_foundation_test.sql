begin;

select plan(18);

select has_table('app_private', 'trips', 'trips table exists');
select has_table('app_private', 'trip_access_tokens', 'trip access token table exists');
select has_table('app_private', 'resource_versions', 'resource version table exists');

select is(
  (select relrowsecurity from pg_class where oid = 'app_private.trips'::regclass),
  true,
  'trips has RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'app_private.trip_access_tokens'::regclass),
  true,
  'access tokens have RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'app_private.resource_versions'::regclass),
  true,
  'resource versions have RLS enabled'
);

select table_privs_are('app_private', 'trips', 'anon', array[]::text[], 'anon has no trip table privileges');
select table_privs_are('app_private', 'trip_access_tokens', 'anon', array[]::text[], 'anon has no token table privileges');
select table_privs_are('app_private', 'resource_versions', 'authenticated', array[]::text[], 'authenticated has no version table privileges');

select function_privs_are('public', 'verify_trip_access', array['text'], 'anon', array[]::text[], 'anon cannot execute access verification');
select function_privs_are('public', 'reset_trip_access_token', array['uuid'], 'authenticated', array[]::text[], 'authenticated cannot reset access');

select lives_ok(
  $$ create temporary table access_test_fixture as
    select public.reset_trip_access_token('11111111-1111-4111-8111-111111111111') as token $$,
  'service operation can generate an access token'
);

select isnt(
  (select token_hash from app_private.trip_access_tokens where revoked_at is null),
  (select token from access_test_fixture),
  'database never stores the raw private token'
);

select is(
  (select count(*)::integer from public.verify_trip_access((select token from access_test_fixture))),
  1,
  'valid token resolves one trip'
);

select is(
  (select count(*)::integer from public.verify_trip_access(encode(extensions.gen_random_bytes(32), 'hex'))),
  0,
  'unknown token resolves no trip'
);

select ok(
  public.revoke_trip_access_token((select token from access_test_fixture)),
  'active token can be revoked'
);

select is(
  (select count(*)::integer from public.verify_trip_access((select token from access_test_fixture))),
  0,
  'revoked token resolves no trip'
);

select matches(
  (select token from access_test_fixture),
  '^[A-Za-z0-9_-]{43}$',
  'generated token contains 256 bits of URL-safe random input'
);

select * from finish();
rollback;
