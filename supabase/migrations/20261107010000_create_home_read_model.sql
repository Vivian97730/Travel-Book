alter table app_private.trips
  add column subtitle text,
  add column traveler_count smallint;

update app_private.trips
set
  subtitle = title,
  traveler_count = 4;

alter table app_private.trips
  alter column subtitle set not null,
  alter column traveler_count set not null,
  add constraint trips_subtitle_length check (length(trim(subtitle)) between 1 and 160),
  add constraint trips_traveler_count_range check (traveler_count between 1 and 20);

create table app_private.flights (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references app_private.trips(id) on delete cascade,
  direction text not null,
  legs_json jsonb not null,
  departure_at timestamptz not null,
  arrival_at timestamptz not null,
  constraint flights_direction_supported check (direction in ('去程', '回程')),
  constraint flights_legs_shape check (
    case
      when jsonb_typeof(legs_json) = 'array' then jsonb_array_length(legs_json) >= 2
      else false
    end
  ),
  constraint flights_timeline check (arrival_at > departure_at),
  unique (trip_id, direction)
);

create index flights_trip_departure_idx
  on app_private.flights (trip_id, departure_at);

create table app_private.travel_facts (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references app_private.trips(id) on delete cascade,
  icon text not null,
  title text not null,
  content text not null,
  sort_order integer not null,
  constraint travel_facts_icon_supported check (icon in ('globe', 'exchange', 'plug', 'water', 'info')),
  constraint travel_facts_title_length check (length(trim(title)) between 1 and 80),
  constraint travel_facts_content_length check (length(trim(content)) between 1 and 500),
  constraint travel_facts_sort_order_nonnegative check (sort_order >= 0),
  unique (trip_id, sort_order)
);

alter table app_private.flights enable row level security;
alter table app_private.flights force row level security;
alter table app_private.travel_facts enable row level security;
alter table app_private.travel_facts force row level security;

revoke all on app_private.flights, app_private.travel_facts from public, anon, authenticated;
grant select, insert, update, delete on app_private.flights, app_private.travel_facts to service_role;

create or replace function public.get_trip_home(p_trip_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, app_private
as $$
  select jsonb_build_object(
    'title', trip.title,
    'subtitle', trip.subtitle,
    'startDate', trip.start_date::text,
    'endDate', trip.end_date::text,
    'displayTimezone', trip.display_timezone,
    'travelerCount', trip.traveler_count,
    'version', version.version,
    'flights', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', flight.id,
          'direction', flight.direction,
          'legs', flight.legs_json,
          'departureAt', flight.departure_at,
          'arrivalAt', flight.arrival_at,
          'durationMinutes', floor(extract(epoch from flight.arrival_at - flight.departure_at) / 60)::integer
        ) order by flight.departure_at
      )
      from app_private.flights as flight
      where flight.trip_id = trip.id
    ), '[]'::jsonb),
    'facts', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', fact.id,
          'icon', fact.icon,
          'title', fact.title,
          'content', fact.content,
          'sortOrder', fact.sort_order
        ) order by fact.sort_order
      )
      from app_private.travel_facts as fact
      where fact.trip_id = trip.id
    ), '[]'::jsonb)
  )
  from app_private.trips as trip
  join app_private.resource_versions as version
    on version.trip_id = trip.id and version.resource_type = 'home'
  where trip.id = p_trip_id;
$$;

revoke all on function public.get_trip_home(uuid) from public, anon, authenticated;
grant execute on function public.get_trip_home(uuid) to service_role;
