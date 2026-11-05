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

insert into app_private.places (id, name, address, latitude, longitude, map_url) values
  ('30000000-0000-4000-8000-000000000001', 'Schloss Schonbrunn', 'Schönbrunner Schloßstraße 47, Wien', 48.1845, 16.3122, 'https://www.google.com/maps/search/?api=1&query=Schloss%20Schonbrunn'),
  ('30000000-0000-4000-8000-000000000002', 'Cafe Central', 'Herrengasse 14, Wien', 48.2104, 16.3655, 'https://www.google.com/maps/search/?api=1&query=Cafe%20Central')
on conflict (id) do update set
  name = excluded.name,
  address = excluded.address,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  map_url = excluded.map_url;

insert into app_private.trip_days (id, trip_id, local_date, city_name, summary) values
  ('10000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '2027-02-05', '維也納', '抵達維也納，慢慢熟悉城市與周邊環境。'),
  ('10000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', '2027-02-06', '維也納', '今天步調舒緩，景點集中在市中心。'),
  ('10000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', '2027-02-07', '維也納', '沿著維也納舊城探索建築與咖啡館。'),
  ('10000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', '2027-02-08', '哈修塔特', '前往湖區，保留彈性欣賞沿途風景。'),
  ('10000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', '2027-02-09', '哈修塔特', '在湖畔慢遊並留意冬季交通時間。'),
  ('10000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', '2027-02-10', '布達佩斯', '移動至布達佩斯，傍晚沿多瑙河散步。'),
  ('10000000-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111', '2027-02-11', '布達佩斯', '探索佩斯城區與市場周邊。'),
  ('10000000-0000-4000-8000-000000000008', '11111111-1111-4111-8111-111111111111', '2027-02-12', '布達佩斯', '安排城堡山與河岸景點。'),
  ('10000000-0000-4000-8000-000000000009', '11111111-1111-4111-8111-111111111111', '2027-02-13', '布達佩斯', '保留購物與自由活動時間。'),
  ('10000000-0000-4000-8000-000000000010', '11111111-1111-4111-8111-111111111111', '2027-02-14', '維也納', '返回維也納，整理最後採買與行李。'),
  ('10000000-0000-4000-8000-000000000011', '11111111-1111-4111-8111-111111111111', '2027-02-15', '返程', '整理行李並預留充足時間前往機場。')
on conflict (trip_id, local_date) do update set
  city_name = excluded.city_name,
  summary = excluded.summary;

insert into app_private.itinerary_items (id, trip_day_id, type, title, sort_order, place_id, notes) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'transit', '搭地鐵前往美泉宮', 0, null, '從住宿地點出發，約 25 分鐘'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'sight', '美泉宮與花園', 1, '30000000-0000-4000-8000-000000000001', '預留 2.5 小時，戶外注意保暖'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'food', '中央咖啡館午餐', 2, '30000000-0000-4000-8000-000000000002', '尖峰可能候位，備案在地圖收藏'),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'shopping', '維也納舊城散步', 3, null, '依體力彈性調整')
on conflict (id) do update set
  type = excluded.type,
  title = excluded.title,
  sort_order = excluded.sort_order,
  place_id = excluded.place_id,
  notes = excluded.notes;
