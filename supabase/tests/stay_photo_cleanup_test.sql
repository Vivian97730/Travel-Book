begin;
-- Transaction-scoped metadata fixtures; never manipulate real Storage objects.
do $$
declare
  trip uuid := '11111111-1111-4111-8111-111111111111';
  photo uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  second_photo uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  input jsonb := '{"name":"照片測試","city":"測試","address":"測試","startDate":"2027-02-06","endDate":"2027-02-08","checkin":"15:00","checkout":"11:00","photo":{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}}';
  saved jsonb;
  second jsonb;
  stay_id uuid;
begin
  insert into storage.objects(bucket_id,name) values ('stay-photos',trip::text || '/' || photo::text || '.jpg');
  saved := public.mutate_trip_stay(trip,'create',null,input,0,gen_random_uuid());
  stay_id := (saved->'stays'->0->>'id')::uuid;
  second := public.mutate_trip_stay(trip,'create',null,input,0,gen_random_uuid());
  assert public.claim_stay_photo_cleanup(trip,photo) = '[]'::jsonb, 'referenced photo must not be claimed';
  -- A failed transaction must not enqueue or detach the current photo.
  begin
    perform public.mutate_trip_stay(trip,'update',stay_id,input || '{"photo":null}'::jsonb,1,gen_random_uuid());
    raise exception using errcode = 'Z0001', message = 'simulate rollback';
  exception when sqlstate 'Z0001' then null;
  end;
  assert not exists(select 1 from app_private.stay_photo_cleanup where trip_id=trip and photo_id=photo and state <> 'pending'), 'rollback cannot claim the current photo';
  assert (select uploaded_photo_id = photo from app_private.stays where id=stay_id), 'rollback preserves the photo association';
  perform public.mutate_trip_stay(trip,'update',stay_id,input || '{"photo":null}'::jsonb,1,gen_random_uuid());
  assert exists(select 1 from app_private.stay_photo_cleanup where trip_id=trip and photo_id=photo and state='pending'), 'removal queues old photo';
  assert public.claim_stay_photo_cleanup(trip) = '[]'::jsonb, 'shared photo must survive removal from one stay';
  perform public.mutate_trip_stay(trip,'delete',(second->'stays'->0->>'id')::uuid,null,1,gen_random_uuid());
  assert public.claim_stay_photo_cleanup(trip) = jsonb_build_array(photo), 'last reference removal allows cleanup';
  begin
    perform public.mutate_trip_stay(trip,'update',stay_id,input,2,gen_random_uuid());
    raise exception 'late attachment unexpectedly succeeded';
  exception when sqlstate '22023' then null;
  end;
  assert public.claim_stay_photo_cleanup(trip) = jsonb_build_array(photo), 'failed Storage delete remains retryable';
  perform public.complete_stay_photo_cleanup(trip,array[photo]);
  assert public.claim_stay_photo_cleanup(trip) = '[]'::jsonb, 'completed cleanup is not automatically retried';
  assert public.claim_stay_photo_cleanup(trip,photo) = jsonb_build_array(photo), 'explicit cleanup retry is idempotent';
  perform public.complete_stay_photo_cleanup(trip,array[photo]);
  begin
    perform public.mutate_trip_stay(trip,'update',stay_id,input,2,gen_random_uuid());
    raise exception 'deleted photo unexpectedly attached';
  exception when sqlstate '22023' then null;
  end;
  assert public.claim_stay_photo_cleanup('22222222-2222-4222-8222-222222222222',photo) = '[]'::jsonb, 'other trip cannot claim this photo';
  insert into storage.objects(bucket_id,name) values ('stay-photos',trip::text || '/' || second_photo::text || '.jpg');
  assert public.claim_stay_photo_cleanup(trip,second_photo) = jsonb_build_array(second_photo), 'failed-save upload can be claimed';
  -- Replacement queues the old photo in the same transaction as the new link.
  insert into storage.objects(bucket_id,name) values
    ('stay-photos',trip::text || '/cccccccc-cccc-4ccc-8ccc-cccccccccccc.jpg'),
    ('stay-photos',trip::text || '/dddddddd-dddd-4ddd-8ddd-dddddddddddd.jpg');
  saved := public.mutate_trip_stay(trip,'create',null,input || '{"photo":{"id":"cccccccc-cccc-4ccc-8ccc-cccccccccccc"}}'::jsonb,0,gen_random_uuid());
  perform public.mutate_trip_stay(trip,'update',(saved->'stays'->0->>'id')::uuid,input || '{"photo":{"id":"dddddddd-dddd-4ddd-8ddd-dddddddddddd"}}'::jsonb,1,gen_random_uuid());
  assert exists(select 1 from app_private.stay_photo_cleanup where trip_id=trip and photo_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc' and state='pending'), 'replacement atomically queues old photo';
  assert public.claim_stay_photo_cleanup(trip,'dddddddd-dddd-4ddd-8ddd-dddddddddddd') = '[]'::jsonb, 'replacement photo stays protected';
  assert not has_function_privilege('anon','public.claim_stay_photo_cleanup(uuid,uuid)','execute'), 'anonymous RPC access forbidden';
  assert not has_function_privilege('authenticated','public.complete_stay_photo_cleanup(uuid,uuid[])','execute'), 'browser RPC access forbidden';
  assert not has_table_privilege('authenticated','app_private.stay_photo_cleanup','select'), 'cleanup data is private';
  insert into app_private.trips(id,title,subtitle,traveler_count,start_date,end_date,display_timezone)
    values ('22222222-2222-4222-8222-222222222222','測試旅程','測試',4,'2027-02-05','2027-02-15','Europe/Vienna');
  insert into app_private.resource_versions(trip_id,resource_type)
    values ('22222222-2222-4222-8222-222222222222','stays');
  insert into storage.objects(bucket_id,name) values ('stay-photos','22222222-2222-4222-8222-222222222222/' || photo::text || '.jpg');
  second := public.mutate_trip_stay('22222222-2222-4222-8222-222222222222','create',null,input,0,gen_random_uuid());
  assert public.claim_stay_photo_cleanup('22222222-2222-4222-8222-222222222222',photo) = '[]'::jsonb, 'same photo UUID in another trip remains independent';
  delete from app_private.trips where id='22222222-2222-4222-8222-222222222222';
  assert not exists(select 1 from app_private.stays where id=(second->'stays'->0->>'id')::uuid), 'photo queue does not block trip cascade';
end;
$$;
-- pgTAP-compatible result for supabase test db.
select '1..1' as tap;
select 'ok 1 - Stay photo references, cleanup fencing, retries and permissions passed' as tap;
rollback;
