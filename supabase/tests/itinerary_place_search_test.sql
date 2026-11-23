begin;
set local search_path=public,extensions,pg_catalog;
select plan(31);
select is((select relforcerowsecurity from pg_class where oid='app_private.place_search_cache'::regclass),true,'search cache forces RLS');
select table_privs_are('app_private','place_search_cache','anon',array[]::text[],'anon cannot read queries or candidates');
select function_privs_are('public','claim_place_search',array['uuid','text','uuid'],'authenticated',array[]::text[],'authenticated cannot bypass the Edge authorization');
select function_privs_are('public','finish_place_search',array['uuid','text','uuid','jsonb'],'anon',array[]::text[],'anon cannot forge candidates');

insert into app_private.trips(id,title,traveler_count,start_date,end_date,display_timezone)
values('99999999-9999-4999-8999-999999999999','Search isolation fixture',4,'2027-02-05','2027-02-15','Europe/Vienna');
select is(public.claim_place_search('11111111-1111-4111-8111-111111111111','church, wien','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->>'status','claimed','first search obtains the durable lease');
select is(public.claim_place_search('99999999-9999-4999-8999-999999999999','other, wien','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')->>'status','busy','another trip cannot overlap upstream calls');
select throws_ok($$select public.finish_place_search('11111111-1111-4111-8111-111111111111','church, wien','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','[]')$$,'22023','SEARCH_LEASE_EXPIRED','wrong lease cannot release the gate');
select public.finish_place_search('11111111-1111-4111-8111-111111111111','church, wien','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','[{"id":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","name":"Fixture Church","address":"Wien","latitude":48.2,"longitude":16.3,"mapUrl":"https://www.openstreetmap.org/way/123"}]');
select is(public.claim_place_search('11111111-1111-4111-8111-111111111111','church, wien','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')->>'status','cached','same trip reuses cached result without another lease');
select is(public.claim_place_search('99999999-9999-4999-8999-999999999999','church, wien','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')->>'status','busy','another trip cannot read cached candidates and cooldown applies');
select is((select count(*) from app_private.places where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'),0::bigint,'search alone does not create a business place');

-- Save an authorized search candidate with the ordered batch.
select lives_ok($$select public.save_trip_day_items('11111111-1111-4111-8111-111111111111','2027-02-06','[{"id":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","title":"Fixture Church","note":"Test","category":"sight","sortOrder":0,"placeId":"cccccccc-cccc-4ccc-8ccc-cccccccccccc"}]',1,'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')$$,'candidate and new itinerary item save atomically');
select is(public.get_trip_day('11111111-1111-4111-8111-111111111111','2027-02-06')->'items'->0->'place'->>'id','cccccccc-cccc-4ccc-8ccc-cccccccccccc','read model returns selected location');
select is((public.get_trip_day('11111111-1111-4111-8111-111111111111','2027-02-06')->'items'->0->'place'->>'latitude')::numeric,48.2,'read model returns actual latitude');
select lives_ok($$select public.save_trip_day_items('11111111-1111-4111-8111-111111111111','2027-02-06','[]',1,'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')$$,'retry replays response before checking stale version');
select is((select version from app_private.trip_days where local_date='2027-02-06' and trip_id='11111111-1111-4111-8111-111111111111'),2::bigint,'retry does not bump version again');
select throws_ok($$select public.save_trip_day_items('11111111-1111-4111-8111-111111111111','2027-02-06','[]',1,'ffffffff-ffff-4fff-8fff-ffffffffffff')$$,'P0001','VERSION_CONFLICT','stale draft cannot overwrite selected place');

insert into app_private.trip_days(trip_id,local_date,city_name,summary) values('99999999-9999-4999-8999-999999999999','2027-02-06','Wien','Fixture');
select throws_ok($$select public.save_trip_day_items('99999999-9999-4999-8999-999999999999','2027-02-06','[{"id":"ffffffff-ffff-4fff-8fff-ffffffffffff","title":"Other trip","note":"Test","category":"sight","sortOrder":0,"placeId":"cccccccc-cccc-4ccc-8ccc-cccccccccccc"}]',1,'ffffffff-ffff-4fff-8fff-ffffffffffff')$$,'22023','VALIDATION_FAILED','cannot reuse another trip candidate or business place');
select throws_ok($$select public.save_trip_day_items('11111111-1111-4111-8111-111111111111','2027-02-06','[{"id":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","title":"Church","note":"Test","category":"sight","sortOrder":0,"placeId":"ffffffff-ffff-4fff-8fff-ffffffffffff"}]',2,'ffffffff-ffff-4fff-8fff-ffffffffffff')$$,'22023','VALIDATION_FAILED','unknown candidate cannot be forged');
select lives_ok($$select public.save_trip_day_items('11111111-1111-4111-8111-111111111111','2027-02-06','[{"id":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","title":"Changed title","note":"Test","category":"sight","sortOrder":0}]',2,'ffffffff-ffff-4fff-8fff-ffffffffffff')$$,'old clients may omit placeId');
select is(public.get_trip_day('11111111-1111-4111-8111-111111111111','2027-02-06')->'items'->0->'place'->>'id','cccccccc-cccc-4ccc-8ccc-cccccccccccc','omission preserves existing location');
select lives_ok($$select public.save_trip_day_items('11111111-1111-4111-8111-111111111111','2027-02-06','[{"id":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","title":"No place","note":"Test","category":"sight","sortOrder":0,"placeId":null}]',3,'abababab-abab-4bab-8bab-abababababab')$$,'explicit null removes the link');
select is(public.get_trip_day('11111111-1111-4111-8111-111111111111','2027-02-06')->'items'->0->'place','null'::jsonb,'removed place is absent from map input');
select is((select count(*) from app_private.places where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'),1::bigint,'removing a link does not delete shared place data');
update app_private.place_search_cache set expires_at=clock_timestamp()-interval '1 second';
select throws_ok($$select public.save_trip_day_items('11111111-1111-4111-8111-111111111111','2027-02-06','[{"id":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","title":"Expired","note":"Test","category":"sight","sortOrder":0,"placeId":"cccccccc-cccc-4ccc-8ccc-cccccccccccc"}]',4,'bcbcbcbc-bcbc-4cbc-8cbc-bcbcbcbcbcbc')$$,'22023','VALIDATION_FAILED','expired candidate must be searched again');
update app_private.place_search_gate set busy_until='-infinity';
select is(public.claim_place_search('11111111-1111-4111-8111-111111111111','empty, wien','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->>'status','claimed','expired results do not prevent a new provider call');
select public.finish_place_search('11111111-1111-4111-8111-111111111111','empty, wien','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','[]');
select is(public.claim_place_search('11111111-1111-4111-8111-111111111111','empty, wien','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')->>'status','cached','empty results are also cached');
select is(public.claim_place_search('11111111-1111-4111-8111-111111111111','empty, wien','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')->'candidates','[]'::jsonb,'empty cache returns no made-up location');
update app_private.place_search_gate set busy_until='-infinity';
select public.claim_place_search('11111111-1111-4111-8111-111111111111','second, wien','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select public.finish_place_search('11111111-1111-4111-8111-111111111111','second, wien','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','[{"id":"cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd","name":"Second Church","address":"Wien","latitude":48.3,"longitude":16.4,"mapUrl":"https://www.openstreetmap.org/node/124"}]');
select lives_ok($$select public.save_trip_day_items('11111111-1111-4111-8111-111111111111','2027-02-06','[{"id":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","title":"Second Church","note":"Test","category":"sight","sortOrder":0,"placeId":"cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd"}]',4,'bcbcbcbc-bcbc-4cbc-8cbc-bcbcbcbcbcbc')$$,'edit can select a different search candidate');
select is(public.get_trip_day('11111111-1111-4111-8111-111111111111','2027-02-06')->'items'->0->'place'->>'id','cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd','edited marker uses the replacement place');
select is((select latitude::numeric from app_private.places where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'),48.2,'replacing the association does not mutate old shared coordinates');
update app_private.place_search_gate set busy_until='-infinity';
select public.claim_place_search('11111111-1111-4111-8111-111111111111','failed, wien','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select public.finish_place_search('11111111-1111-4111-8111-111111111111','failed, wien','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null);
select is((select count(*) from app_private.place_search_cache where query_key='failed, wien'),0::bigint,'provider failures never become cached empty results');
select * from finish();
rollback;
