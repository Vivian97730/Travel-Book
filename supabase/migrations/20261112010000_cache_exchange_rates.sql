create table app_private.exchange_rate_requests (
  currency text not null check (currency in ('EUR', 'HUF')),
  requested_date date not null check (isfinite(requested_date)),
  formula_version integer not null check (formula_version > 0),
  snapshot_id uuid,
  lease_id uuid not null,
  lease_until timestamptz not null,
  primary key (currency, requested_date, formula_version),
  foreign key (snapshot_id, currency)
    references app_private.exchange_rate_snapshots(id, base_currency)
);

alter table app_private.exchange_rate_requests enable row level security;
alter table app_private.exchange_rate_requests force row level security;
revoke all on app_private.exchange_rate_requests from public, anon, authenticated;

create function app_private.rate_snapshot_payload(snapshot app_private.exchange_rate_snapshots)
returns jsonb
language sql stable strict
set search_path = pg_catalog
as $$
  select jsonb_build_object(
    'id', snapshot.id, 'baseCurrency', snapshot.base_currency, 'quoteCurrency', snapshot.quote_currency,
    'rate', snapshot.rate::text, 'source', snapshot.source, 'sourceDate', snapshot.source_date::text,
    'fetchedAt', snapshot.fetched_at, 'formulaVersion', snapshot.formula_version
  );
$$;

create function public.claim_exchange_rate(p_currency text, p_date date, p_version integer, p_lease uuid)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, app_private
as $$
declare
  snapshot app_private.exchange_rate_snapshots;
  claimed uuid;
begin
  select s.* into snapshot
  from app_private.exchange_rate_requests r
  join app_private.exchange_rate_snapshots s on s.id = r.snapshot_id
  where r.currency = p_currency and r.requested_date = p_date and r.formula_version = p_version;
  if not found then
    select s.* into snapshot
    from app_private.exchange_rate_snapshots s
    where s.base_currency = p_currency and s.formula_version = p_version
      and (s.source_date = p_date or (s.source_date < p_date and exists (
        select 1 from app_private.exchange_rate_requests r
        where r.snapshot_id = s.id and r.requested_date >= p_date
      )))
    order by s.source_date desc
    limit 1;
  end if;
  if found then
    return jsonb_build_object('snapshot', app_private.rate_snapshot_payload(snapshot));
  end if;

  insert into app_private.exchange_rate_requests as request
    (currency, requested_date, formula_version, lease_id, lease_until)
  values (p_currency, p_date, p_version, p_lease, clock_timestamp() + interval '20 seconds')
  on conflict (currency, requested_date, formula_version) do update
    set lease_id = excluded.lease_id, lease_until = excluded.lease_until
    where request.snapshot_id is null and request.lease_until <= clock_timestamp()
  returning lease_id into claimed;

  return jsonb_build_object('claimed', claimed is not null);
end;
$$;

create function public.finish_exchange_rate(
  p_currency text, p_date date, p_version integer, p_lease uuid,
  p_rate numeric, p_source text, p_source_date date
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, app_private
as $$
declare
  request app_private.exchange_rate_requests;
  snapshot app_private.exchange_rate_snapshots;
begin
  select * into request from app_private.exchange_rate_requests
  where currency = p_currency and requested_date = p_date and formula_version = p_version
  for update;

  if not found or request.lease_id <> p_lease or request.snapshot_id is not null
    or request.lease_until <= clock_timestamp() then
    return null;
  end if;

  if p_rate is null then
    update app_private.exchange_rate_requests set lease_until = clock_timestamp() + interval '15 seconds'
    where currency = p_currency and requested_date = p_date and formula_version = p_version;
    return null;
  end if;

  if p_source_date is null or p_source_date > p_date then
    raise exception 'RATE_SOURCE_DATE_INVALID';
  end if;
  insert into app_private.exchange_rate_snapshots
    (base_currency, rate, source, source_date, formula_version)
  values (p_currency, p_rate, p_source, p_source_date, p_version)
  on conflict (base_currency, source_date, formula_version) do nothing;

  select * into strict snapshot from app_private.exchange_rate_snapshots
  where base_currency = p_currency and source_date = p_source_date and formula_version = p_version;

  update app_private.exchange_rate_requests set snapshot_id = snapshot.id
  where currency = p_currency and requested_date = p_date and formula_version = p_version;

  return app_private.rate_snapshot_payload(snapshot);
end;
$$;

revoke all on function public.claim_exchange_rate(text, date, integer, uuid) from public, anon, authenticated;
revoke all on function public.finish_exchange_rate(text, date, integer, uuid, numeric, text, date) from public, anon, authenticated;
grant execute on function public.claim_exchange_rate(text, date, integer, uuid) to service_role;
grant execute on function public.finish_exchange_rate(text, date, integer, uuid, numeric, text, date) to service_role;
