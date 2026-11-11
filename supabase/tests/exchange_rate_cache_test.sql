begin;
set local search_path = public, extensions, pg_catalog;
select plan(2);

set local role service_role;
do $$
declare
  first_lease uuid := 'ec000000-0000-4000-8000-000000000001';
  second_lease uuid := 'ec000000-0000-4000-8000-000000000002';
  snapshot jsonb;
begin
  assert public.claim_exchange_rate('EUR', '2026-11-01', 1, first_lease) = '{"claimed":true}'::jsonb;
  assert public.claim_exchange_rate('EUR', '2026-11-01', 1, second_lease) = '{"claimed":false}'::jsonb;
  assert public.finish_exchange_rate('EUR', '2026-11-01', 1, second_lease, 999, 'Other', '2026-10-30') is null;

  snapshot := public.finish_exchange_rate('EUR', '2026-11-01', 1, first_lease, 36.36, 'Fixture', '2026-10-30');
  assert snapshot->>'rate' = '36.36' and snapshot->>'sourceDate' = '2026-10-30';
  assert snapshot->>'formulaVersion' = '1' and snapshot->>'fetchedAt' is not null;
  assert public.claim_exchange_rate('EUR', '2026-11-01', 1, second_lease)->'snapshot' = snapshot;
  assert public.claim_exchange_rate('EUR', '2026-10-31', 1, second_lease)->'snapshot' = snapshot;
  assert public.claim_exchange_rate('EUR', '2026-10-30', 1, second_lease)->'snapshot' = snapshot;

  assert public.claim_exchange_rate('EUR', '2026-11-02', 1, second_lease) = '{"claimed":true}'::jsonb;
  assert public.finish_exchange_rate('EUR', '2026-11-02', 1, second_lease, 99, 'Other', '2026-10-30') = snapshot;
  assert public.claim_exchange_rate('EUR', '2026-11-01', 2, second_lease) = '{"claimed":true}'::jsonb;

  assert public.claim_exchange_rate('HUF', '2026-11-01', 1, first_lease) = '{"claimed":true}'::jsonb;
  assert public.finish_exchange_rate('HUF', '2026-11-01', 1, first_lease, null, null, null) is null;
  assert public.claim_exchange_rate('HUF', '2026-11-01', 1, second_lease) = '{"claimed":false}'::jsonb;
end;
$$;
reset role;
select pass('leases, persistent fallback reuse, failure cooldown and immutable snapshots');

do $$
begin
  assert not has_function_privilege('anon', 'public.claim_exchange_rate(text,date,integer,uuid)', 'EXECUTE');
  assert not has_function_privilege('authenticated', 'public.finish_exchange_rate(text,date,integer,uuid,numeric,text,date)', 'EXECUTE');
end;
$$;
select pass('browser roles cannot claim or store rates');

select * from finish();
rollback;
