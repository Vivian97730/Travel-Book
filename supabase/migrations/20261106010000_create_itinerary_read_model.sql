create table app_private.places (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  address text not null default '',
  latitude double precision,
  longitude double precision,
  map_url text,
  constraint places_latitude_range check (latitude is null or latitude between -90 and 90),
  constraint places_longitude_range check (longitude is null or longitude between -180 and 180),
  constraint places_coordinate_pair check ((latitude is null) = (longitude is null))
);

create table app_private.trip_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references app_private.trips(id) on delete cascade,
  local_date date not null,
  city_name text not null check (length(trim(city_name)) between 1 and 80),
  summary text not null check (length(trim(summary)) between 1 and 500),
  version bigint not null default 1 check (version >= 1),
  unique (trip_id, local_date)
);

create table app_private.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  trip_day_id uuid not null references app_private.trip_days(id) on delete cascade,
  type text not null check (type in ('food', 'stay', 'transit', 'sight', 'shopping')),
  title text not null check (length(trim(title)) between 1 and 120),
  sort_order integer not null check (sort_order >= 0),
  place_id uuid references app_private.places(id) on delete set null,
  notes text not null check (length(trim(notes)) between 1 and 500),
  unique (trip_day_id, sort_order)
);

alter table app_private.places enable row level security;
alter table app_private.places force row level security;
alter table app_private.trip_days enable row level security;
alter table app_private.trip_days force row level security;
alter table app_private.itinerary_items enable row level security;
alter table app_private.itinerary_items force row level security;

revoke all on app_private.places, app_private.trip_days, app_private.itinerary_items from public, anon, authenticated;
grant select, insert, update, delete on app_private.places, app_private.trip_days, app_private.itinerary_items to service_role;

create or replace function public.get_trip_day(p_trip_id uuid, p_date date)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, app_private
as $$
  select jsonb_build_object(
    'date', day.local_date::text,
    'weekday', case extract(isodow from day.local_date)
      when 1 then '一' when 2 then '二' when 3 then '三' when 4 then '四'
      when 5 then '五' when 6 then '六' else '日' end,
    'city', day.city_name,
    'summary', day.summary,
    'version', day.version,
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', item.id,
          'title', item.title,
          'note', item.notes,
          'category', item.type,
          'sortOrder', item.sort_order,
          'place', case when place.id is null then null else jsonb_build_object(
            'id', place.id,
            'name', place.name,
            'latitude', place.latitude,
            'longitude', place.longitude
          ) end
        ) order by item.sort_order
      )
      from app_private.itinerary_items as item
      left join app_private.places as place on place.id = item.place_id
      where item.trip_day_id = day.id
    ), '[]'::jsonb)
  )
  from app_private.trip_days as day
  where day.trip_id = p_trip_id and day.local_date = p_date;
$$;

revoke all on function public.get_trip_day(uuid, date) from public, anon, authenticated;
grant execute on function public.get_trip_day(uuid, date) to service_role;
