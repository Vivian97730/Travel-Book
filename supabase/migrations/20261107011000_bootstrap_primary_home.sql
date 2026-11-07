update app_private.trips
set
  title = '2027 過年東歐遊',
  subtitle = '維也納・哈修塔特・布達佩斯',
  traveler_count = 4,
  updated_at = now()
where id = '11111111-1111-4111-8111-111111111111';

insert into app_private.resource_versions (trip_id, resource_type, version)
values ('11111111-1111-4111-8111-111111111111', 'home', 1)
on conflict (trip_id, resource_type) do nothing;

insert into app_private.flights (
  id,
  trip_id,
  direction,
  legs_json,
  departure_at,
  arrival_at
) values
  (
    '40000000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    '去程',
    '[
      {"airport":"TPE","city":"桃園","time":"00:20"},
      {"airport":"DXB","city":"杜拜轉機","time":"06:15－08:55"},
      {"airport":"VIE","city":"維也納","time":"12:25"}
    ]'::jsonb,
    '2027-02-05 00:20:00+08',
    '2027-02-05 12:25:00+01'
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    '11111111-1111-4111-8111-111111111111',
    '回程',
    '[
      {"airport":"VIE","city":"維也納","time":"21:45"},
      {"airport":"DXB","city":"杜拜轉機","time":"06:25－08:45","dayOffset":1},
      {"airport":"TPE","city":"桃園","time":"20:40","dayOffset":1}
    ]'::jsonb,
    '2027-02-15 21:45:00+01',
    '2027-02-16 20:40:00+08'
  )
on conflict (id) do update set
  trip_id = excluded.trip_id,
  direction = excluded.direction,
  legs_json = excluded.legs_json,
  departure_at = excluded.departure_at,
  arrival_at = excluded.arrival_at;

insert into app_private.travel_facts (
  id,
  trip_id,
  icon,
  title,
  content,
  sort_order
) values
  ('50000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'globe', '和台灣的時差', '冬季慢 7 小時', 0),
  ('50000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'exchange', '參考匯率', 'EUR 1 ≈ TWD 35.2', 1),
  ('50000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'plug', '插座形狀', 'Type C／F，電壓 230V', 2),
  ('50000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'water', '自來水', '奧地利可直接生飲', 3)
on conflict (id) do update set
  trip_id = excluded.trip_id,
  icon = excluded.icon,
  title = excluded.title,
  content = excluded.content,
  sort_order = excluded.sort_order;
