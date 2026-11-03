begin;

select plan(3);

select has_schema('app_private', 'app_private schema exists');
select schema_privs_are(
  'app_private',
  'anon',
  array[]::text[],
  'anonymous browser role has no private schema privileges'
);
select schema_privs_are(
  'app_private',
  'authenticated',
  array[]::text[],
  'authenticated browser role has no private schema privileges'
);

select * from finish();
rollback;
