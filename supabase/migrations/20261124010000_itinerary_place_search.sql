-- Search results are private to the verified trip, and are not business places
-- until the user saves a selected candidate with an itinerary transaction.
create table app_private.place_search_cache (
  trip_id uuid not null references app_private.trips(id) on delete cascade,
  query_key text not null check (length(query_key) between 3 and 202),
  candidates jsonb not null check (jsonb_typeof(candidates) = 'array' and jsonb_array_length(candidates) <= 5),
  expires_at timestamptz not null,
  primary key (trip_id, query_key)
);
create table app_private.place_search_gate (
  singleton boolean primary key default true check (singleton),
  lease uuid,
  busy_until timestamptz not null default '-infinity'
);
insert into app_private.place_search_gate(singleton) values(true);
alter table app_private.place_search_cache enable row level security;
alter table app_private.place_search_cache force row level security;
alter table app_private.place_search_gate enable row level security;
alter table app_private.place_search_gate force row level security;
revoke all on app_private.place_search_cache, app_private.place_search_gate from public, anon, authenticated;
grant select, insert, update, delete on app_private.place_search_cache, app_private.place_search_gate to service_role;

create function public.claim_place_search(p_trip_id uuid, p_key text, p_lease uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, app_private as $$
declare cached jsonb; gate app_private.place_search_gate%rowtype;
begin
  if p_lease is null or p_key is null or length(p_key) not between 3 and 202
    or not exists(select 1 from app_private.trips where id=p_trip_id) then
    raise exception using errcode='22023', message='VALIDATION_FAILED';
  end if;
  select candidates into cached from app_private.place_search_cache
    where trip_id=p_trip_id and query_key=p_key and expires_at>clock_timestamp();
  if cached is not null then return jsonb_build_object('status','cached','candidates',cached); end if;
  select * into gate from app_private.place_search_gate where singleton for update;
  -- Check again after the gate lock in case a prior request just finished.
  select candidates into cached from app_private.place_search_cache
    where trip_id=p_trip_id and query_key=p_key and expires_at>clock_timestamp();
  if cached is not null then return jsonb_build_object('status','cached','candidates',cached); end if;
  if gate.busy_until>clock_timestamp() then return jsonb_build_object('status','busy'); end if;
  update app_private.place_search_gate set lease=p_lease, busy_until=clock_timestamp()+interval '30 seconds' where singleton;
  return jsonb_build_object('status','claimed');
end $$;

create function public.finish_place_search(p_trip_id uuid, p_key text, p_lease uuid, p_candidates jsonb)
returns void language plpgsql security definer set search_path = pg_catalog, app_private as $$
begin
  perform 1 from app_private.place_search_gate where singleton and lease=p_lease for update;
  if not found then raise exception using errcode='22023',message='SEARCH_LEASE_EXPIRED'; end if;
  if p_candidates is not null then
    if jsonb_typeof(p_candidates)<>'array' or jsonb_array_length(p_candidates)>5 then
      raise exception using errcode='22023',message='VALIDATION_FAILED';
    end if;
    delete from app_private.place_search_cache where trip_id=p_trip_id and expires_at<clock_timestamp();
    insert into app_private.place_search_cache(trip_id,query_key,candidates,expires_at)
      values(p_trip_id,p_key,p_candidates,clock_timestamp()+interval '30 days')
      on conflict(trip_id,query_key) do update set candidates=excluded.candidates,expires_at=excluded.expires_at;
  end if;
  -- No upstream calls overlap, plus a one-second cooldown after completion.
  update app_private.place_search_gate set lease=null,busy_until=clock_timestamp()+interval '1100 milliseconds' where singleton;
end $$;
revoke all on function public.claim_place_search(uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.finish_place_search(uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.claim_place_search(uuid,text,uuid), public.finish_place_search(uuid,text,uuid,jsonb) to service_role;

create or replace function public.save_trip_day_items(
  p_trip_id uuid,
  p_date date,
  p_items jsonb,
  p_expected_version bigint,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, app_private
as $$
declare
  v_day_id uuid;
  v_current_version bigint;
  v_response jsonb;
begin
  if jsonb_typeof(p_items) <> 'array' then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  select day.id, day.version
  into v_day_id, v_current_version
  from app_private.trip_days as day
  where day.trip_id = p_trip_id and day.local_date = p_date
  for update;

  if v_day_id is null then
    raise exception using errcode = 'P0002', message = 'RESOURCE_NOT_FOUND';
  end if;

  select request.response
  into v_response
  from app_private.itinerary_save_requests as request
  where request.trip_day_id = v_day_id and request.idempotency_key = p_idempotency_key;

  if v_response is not null then
    return v_response;
  end if;

  if v_current_version <> p_expected_version then
    raise exception using errcode = 'P0001', message = 'VERSION_CONFLICT';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as incoming(id uuid)
    join app_private.itinerary_items as existing on existing.id = incoming.id
    where existing.trip_day_id <> v_day_id
  ) then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  -- Do not trust client coordinates or arbitrary place IDs. A selected ID must
  -- be either this item's existing place or a current candidate for this trip.
  if exists (
    select 1 from jsonb_array_elements(p_items) incoming
    where incoming ? 'placeId' and incoming->'placeId' <> 'null'::jsonb and not (
      exists(select 1 from app_private.itinerary_items old
        where old.id=(incoming->>'id')::uuid and old.trip_day_id=v_day_id
          and old.place_id=(incoming->>'placeId')::uuid)
      or exists(select 1 from app_private.place_search_cache cache,
        lateral jsonb_array_elements(cache.candidates) candidate
        where cache.trip_id=p_trip_id and cache.expires_at>clock_timestamp()
          and candidate->>'id'=incoming->>'placeId')
    )
  ) then raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;

  insert into app_private.places(id,name,address,latitude,longitude,map_url)
    select distinct (candidate->>'id')::uuid,candidate->>'name',candidate->>'address',
      (candidate->>'latitude')::double precision,(candidate->>'longitude')::double precision,candidate->>'mapUrl'
    from app_private.place_search_cache cache, lateral jsonb_array_elements(cache.candidates) candidate
    where cache.trip_id=p_trip_id and cache.expires_at>clock_timestamp()
      and exists(select 1 from jsonb_array_elements(p_items) incoming where incoming->>'placeId'=candidate->>'id')
    on conflict(id) do nothing;

  update app_private.itinerary_items
  set sort_order = sort_order + 100000
  where trip_day_id = v_day_id;

  insert into app_private.itinerary_items (
    id,
    trip_day_id,
    type,
    title,
    sort_order,
    place_id,
    notes
  )
  select
    incoming.id,
    v_day_id,
    incoming.category,
    trim(incoming.title),
    incoming."sortOrder",
    case when exists(select 1 from jsonb_array_elements(p_items) raw
      where raw->>'id'=incoming.id::text and raw ? 'placeId')
      then incoming."placeId" else existing.place_id end,
    trim(incoming.note)
  from jsonb_to_recordset(p_items) as incoming(
    id uuid,
    "placeId" uuid,
    title text,
    note text,
    category text,
    "sortOrder" integer
  )
  left join app_private.itinerary_items as existing on existing.id = incoming.id
  on conflict (id) do update set
    type = excluded.type,
    title = excluded.title,
    sort_order = excluded.sort_order,
    place_id = excluded.place_id,
    notes = excluded.notes;

  delete from app_private.itinerary_items as existing
  where existing.trip_day_id = v_day_id
    and not exists (
      select 1
      from jsonb_to_recordset(p_items) as incoming(id uuid)
      where incoming.id = existing.id
    );

  update app_private.trip_days
  set version = version + 1
  where id = v_day_id;

  update app_private.resource_versions set version=version+1,updated_at=now()
    where trip_id=p_trip_id and resource_type in ('itinerary','snapshot');

  v_response := public.get_trip_day(p_trip_id, p_date);

  insert into app_private.itinerary_save_requests (trip_day_id, idempotency_key, response)
  values (v_day_id, p_idempotency_key, v_response);

  return v_response;
end;
$$;

revoke all on function public.save_trip_day_items(uuid, date, jsonb, bigint, uuid) from public, anon, authenticated;
grant execute on function public.save_trip_day_items(uuid, date, jsonb, bigint, uuid) to service_role;
