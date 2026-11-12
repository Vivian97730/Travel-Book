begin;
set local search_path = public, extensions, pg_catalog;
select plan(2);

insert into app_private.trips (id, title, start_date, end_date, display_timezone, traveler_count)
values
  ('eb000000-0000-4000-8000-000000000001', 'Expense read A', '2027-02-05', '2027-02-15', 'Asia/Taipei', 4),
  ('eb000000-0000-4000-8000-000000000002', 'Expense read B', '2027-02-05', '2027-02-15', 'Asia/Taipei', 4),
  ('eb000000-0000-4000-8000-000000000003', 'Expense read empty', '2027-02-05', '2027-02-15', 'Asia/Taipei', 4);

insert into app_private.exchange_rate_snapshots
  (id, base_currency, rate, source, source_date, formula_version)
values
  ('eb000000-0000-4000-8000-000000000004', 'EUR', 35.21, 'Fixture', '2027-02-05', 1),
  ('eb000000-0000-4000-8000-000000000005', 'EUR', 35.52, 'Fixture', '2027-02-06', 1);

insert into app_private.expenses (trip_id, date, title, category, currency, amount_minor, rate_snapshot_id, reference_twd_minor)
values
  ('eb000000-0000-4000-8000-000000000001', '2027-02-05', 'Lunch', '食物', 'TWD', 9007199254740991, null, 9007199254740991),
  ('eb000000-0000-4000-8000-000000000001', '2027-02-06', 'Flight', '機票', 'TWD', 9007199254740991, null, 9007199254740991),
  ('eb000000-0000-4000-8000-000000000001', '2027-02-05', 'Museum', '景點', 'EUR', 100,
    'eb000000-0000-4000-8000-000000000004', 3521),
  ('eb000000-0000-4000-8000-000000000002', '2027-02-06', 'Private trip B', '交通', 'EUR', 200,
    'eb000000-0000-4000-8000-000000000005', 7104);

set local role service_role;
do $$
declare
  a jsonb := public.get_trip_expenses('eb000000-0000-4000-8000-000000000001');
  b jsonb := public.get_trip_expenses('eb000000-0000-4000-8000-000000000002');
  empty_trip jsonb := public.get_trip_expenses('eb000000-0000-4000-8000-000000000003');
begin
  assert jsonb_array_length(a->'expenses') = 3 and jsonb_array_length(b->'expenses') = 1;
  assert a#>>'{expenses,0,title}' = 'Flight' and b#>>'{expenses,0,title}' = 'Private trip B';
  assert a->'totalsMinor' = '{"TWD":"18014398509481982","EUR":"100","HUF":"0"}'::jsonb;
  assert b->'totalsMinor' = '{"TWD":"0","EUR":"200","HUF":"0"}'::jsonb;
  assert jsonb_array_length(a->'rates') = 1 and a#>>'{rates,0,rate}' = '35.21';
  assert jsonb_array_length(b->'rates') = 1 and b#>>'{rates,0,rate}' = '35.52';
  assert empty_trip = '{"schemaVersion":1,"expenses":[],"totalsMinor":{"TWD":"0","EUR":"0","HUF":"0"},"rates":[]}'::jsonb;
  assert public.get_trip_expenses('eb000000-0000-4000-8000-000000000006') is null;
end;
$$;
reset role;
select pass('server reads only the requested trip with exact totals and associated rates');

do $$
begin
  assert not has_function_privilege('anon', 'public.get_trip_expenses(uuid)', 'EXECUTE');
  assert not has_function_privilege('authenticated', 'public.get_trip_expenses(uuid)', 'EXECUTE');
end;
$$;
select pass('browser roles cannot invoke the expense RPC');

select * from finish();
rollback;
