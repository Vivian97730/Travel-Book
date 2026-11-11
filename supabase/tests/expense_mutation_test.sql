begin;
set local search_path = public, extensions, pg_catalog;
select plan(2);

insert into app_private.trips (id, title, start_date, end_date, display_timezone, traveler_count)
values
  ('ec000000-0000-4000-8000-000000000001', 'Trip A', '2027-02-05', '2027-02-15', 'Asia/Taipei', 4),
  ('ec000000-0000-4000-8000-000000000002', 'Trip B', '2027-02-05', '2027-02-15', 'Asia/Taipei', 4);

insert into app_private.exchange_rate_snapshots (id, base_currency, rate, source, source_date, formula_version)
values
  ('ec000000-0000-4000-8000-000000000003', 'EUR', 35.205, 'Fixture', '2027-02-05', 1),
  ('ec000000-0000-4000-8000-000000000004', 'EUR', 40, 'Fixture', '2027-02-06', 2);

set local role service_role;
do $$
declare
  trip uuid := 'ec000000-0000-4000-8000-000000000001';
  other_trip uuid := 'ec000000-0000-4000-8000-000000000002';
  original_rate uuid := 'ec000000-0000-4000-8000-000000000003';
  newer_rate uuid := 'ec000000-0000-4000-8000-000000000004';
  create_key uuid := gen_random_uuid();
  delete_key uuid := gen_random_uuid();
  input jsonb := '{"title":"Lunch","category":"食物","date":"2027-02-06","currency":"EUR","amountMinor":100}';
  result jsonb;
  expense_id uuid;
begin
  result := public.mutate_trip_expense(trip, 'create', null, input, 0, create_key, original_rate);
  expense_id := (result#>>'{expenses,0,id}')::uuid;
  assert result#>>'{expenses,0,referenceTwdMinor}' = '3521';
  assert result#>>'{expenses,0,snapshotRate}' = '35.205';
  assert public.mutate_trip_expense(trip, 'create', null, input, 0, create_key, newer_rate) = result;
  begin
    perform public.mutate_trip_expense(trip, 'create', null, input || '{"title":"Different"}', 0, create_key, null);
    assert false, 'a changed request cannot reuse the key';
  exception when invalid_parameter_value then null;
  end;
  result := public.mutate_trip_expense(trip, 'update', expense_id, input || '{"amountMinor":200}', 1, gen_random_uuid(), newer_rate);
  assert result#>>'{expenses,0,referenceTwdMinor}' = '7041';
  assert result#>>'{expenses,0,rateSnapshotId}' = original_rate::text;
  assert result#>>'{expenses,0,version}' = '2';
  begin
    perform public.mutate_trip_expense(trip, 'delete', expense_id, null, 1, gen_random_uuid(), null);
    assert false, 'stale deletion should fail';
  exception when raise_exception then assert sqlerrm = 'VERSION_CONFLICT';
  end;
  begin
    perform public.mutate_trip_expense(other_trip, 'delete', expense_id, null, 2, gen_random_uuid(), null);
    assert false, 'cross-trip deletion should fail';
  exception when no_data_found then assert sqlerrm = 'RESOURCE_NOT_FOUND';
  end;
  result := public.mutate_trip_expense(trip, 'update', expense_id,
    input || '{"currency":"HUF","amountMinor":25000}', 2, gen_random_uuid(), null);
  assert result#>>'{totalsMinor,HUF}' = '25000';
  assert result#>'{expenses,0,referenceTwdMinor}' = 'null'::jsonb;
  assert result#>'{expenses,0,rateSnapshotId}' = 'null'::jsonb;
  result := public.mutate_trip_expense(trip, 'delete', expense_id, null, 3, delete_key, null);
  assert result->'expenses' = '[]'::jsonb;
  assert public.mutate_trip_expense(trip, 'delete', expense_id, null, 3, delete_key, null) = result;
  assert public.mutate_trip_expense(trip, 'create', null, input, 0, create_key, null) = result;
end;
$$;
reset role;
select pass('transactions preserve original rates, downgrade without rates, and protect versions, retries and trip isolation');

do $$
begin
  assert not has_function_privilege('anon', 'public.mutate_trip_expense(uuid,text,uuid,jsonb,bigint,uuid,uuid)', 'EXECUTE');
  assert not has_function_privilege('authenticated', 'public.mutate_trip_expense(uuid,text,uuid,jsonb,bigint,uuid,uuid)', 'EXECUTE');
end;
$$;
select pass('browser roles cannot invoke expense mutation RPC');

select * from finish();
rollback;
