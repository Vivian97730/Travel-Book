begin;

set local search_path = public, extensions, pg_catalog;

select plan(13);

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

select * from finish();
rollback;
