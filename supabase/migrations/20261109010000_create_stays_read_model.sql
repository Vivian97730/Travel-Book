alter table app_private.places add column google_place_id text;

create table app_private.stays (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references app_private.trips(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  city text not null check (length(trim(city)) between 1 and 40),
  address text not null check (length(trim(address)) between 1 and 160),
  start_date date not null,
  end_date date not null,
  check_in_time time not null,
  check_out_time time not null,
  place_id uuid references app_private.places(id) on delete restrict,
  photo_resource_name text,
  photo_attribution_json jsonb not null default '[]'::jsonb
    check (jsonb_typeof(photo_attribution_json) = 'array'),
  version bigint not null default 1 check (version >= 1),
  constraint stays_date_order check (end_date > start_date),
  constraint stays_photo_place check (photo_resource_name is null or place_id is not null)
);
create index stays_trip_date_idx on app_private.stays(trip_id, start_date, id);
create function app_private.validate_stay()
returns trigger language plpgsql
set search_path = pg_catalog, app_private
as $$
declare
  trip app_private.trips;
  google_id text;
begin
  select * into trip from app_private.trips where id = new.trip_id;
  if new.start_date < trip.start_date or new.end_date > trip.end_date then
    raise exception using errcode = '23514', message = 'stays_trip_date_range';
  end if;
  if new.photo_resource_name is not null then
    select google_place_id into google_id from app_private.places where id = new.place_id;
    if google_id is null or new.photo_resource_name not like 'places/' || google_id || '/photos/%'
      or new.photo_resource_name = 'places/' || google_id || '/photos/' then
      raise exception using errcode = '23514', message = 'stays_photo_source';
    end if;
  elsif new.photo_attribution_json <> '[]'::jsonb then
    raise exception using errcode = '23514', message = 'stays_photo_source';
  end if;
  return new;
end;
$$;
revoke all on function app_private.validate_stay() from public, anon, authenticated;
create trigger validate_stay before insert or update on app_private.stays
for each row execute function app_private.validate_stay();
alter table app_private.stays enable row level security;
alter table app_private.stays force row level security;
revoke all on app_private.stays from public, anon, authenticated;
grant select, insert, update, delete on app_private.stays to service_role;

create function public.get_trip_stays(p_trip_id uuid)
returns jsonb
language sql stable security definer
set search_path = pg_catalog, app_private
as $$
  select jsonb_build_object(
    'schemaVersion', 1,
    'stays', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', stay.id, 'version', stay.version,
        'name', stay.name, 'city', stay.city, 'address', stay.address,
        'startDate', stay.start_date::text, 'endDate', stay.end_date::text,
        'checkin', to_char(stay.check_in_time, 'HH24:MI'),
        'checkout', to_char(stay.check_out_time, 'HH24:MI'),
        'placeId', stay.place_id,
        'photo', case when stay.photo_resource_name is null then null else
          jsonb_build_object('placeId', place.google_place_id,
            'resourceName', stay.photo_resource_name, 'authors', stay.photo_attribution_json)
          end
      ) order by stay.start_date, stay.id)
      from app_private.stays stay
      left join app_private.places place on place.id = stay.place_id
      where stay.trip_id = p_trip_id
    ), '[]'::jsonb)
  ) from app_private.trips where id = p_trip_id;
$$;
revoke all on function public.get_trip_stays(uuid) from public, anon, authenticated;
grant execute on function public.get_trip_stays(uuid) to service_role;
