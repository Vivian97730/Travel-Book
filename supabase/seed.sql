insert into app_private.trips (id, title, start_date, end_date, display_timezone)
values (
  '11111111-1111-4111-8111-111111111111',
  '2027 奧地利・匈牙利之旅',
  '2027-02-05',
  '2027-02-15',
  'Europe/Vienna'
)
on conflict (id) do update set
  title = excluded.title,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  display_timezone = excluded.display_timezone,
  updated_at = now();

insert into app_private.resource_versions (trip_id, resource_type, version)
select '11111111-1111-4111-8111-111111111111', resource_type, 1
from unnest(array['home', 'itinerary', 'stays', 'expenses', 'checklists', 'snapshot']) as resource_type
on conflict (trip_id, resource_type) do nothing;
