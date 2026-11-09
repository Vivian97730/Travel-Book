insert into app_private.stays (
  id, trip_id, name, city, address, start_date, end_date, check_in_time, check_out_time
) values
  ('60000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   '維也納住宿（示意）', '維也納', 'Mariahilfer Straße 00, 1070 Wien',
   '2027-02-05', '2027-02-08', '15:00', '11:00'),
  ('60000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   '湖畔住宿（示意）', '哈修塔特', 'Seestraße 00, 4830 Hallstatt',
   '2027-02-08', '2027-02-10', '14:00', '10:00')
on conflict (id) do nothing;
