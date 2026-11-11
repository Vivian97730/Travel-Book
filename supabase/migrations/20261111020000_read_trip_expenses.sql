create function public.get_trip_expenses(p_trip_id uuid)
returns jsonb
language sql stable security definer
set search_path = pg_catalog, app_private
as $$
  with trip_expenses as (
    select * from app_private.expenses where trip_id = p_trip_id
  ),
  latest_rates as (
    select distinct on (snapshot.base_currency) snapshot.*
    from trip_expenses expense
    join app_private.exchange_rate_snapshots snapshot on snapshot.id = expense.rate_snapshot_id
    order by snapshot.base_currency, snapshot.source_date desc, snapshot.fetched_at desc, snapshot.id
  )
  select jsonb_build_object(
    'schemaVersion', 1,
    'expenses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'date', date::text, 'title', title, 'category', category,
        'currency', currency, 'amountMinor', amount_minor, 'version', version,
        'rateSnapshotId', rate_snapshot_id, 'referenceTwdMinor', reference_twd_minor
      ) order by date desc, id)
      from trip_expenses
    ), '[]'::jsonb),
    'totalsMinor', (
      select jsonb_build_object(
        'TWD', coalesce(sum(amount_minor) filter (where currency = 'TWD'), 0)::text,
        'EUR', coalesce(sum(amount_minor) filter (where currency = 'EUR'), 0)::text,
        'HUF', coalesce(sum(amount_minor) filter (where currency = 'HUF'), 0)::text
      ) from trip_expenses
    ),
    'rates', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'baseCurrency', base_currency, 'quoteCurrency', quote_currency,
        'rate', rate::text, 'source', source, 'sourceDate', source_date::text,
        'fetchedAt', fetched_at, 'formulaVersion', formula_version
      ) order by base_currency)
      from latest_rates
    ), '[]'::jsonb)
  )
  from app_private.trips where id = p_trip_id;
$$;

revoke all on function public.get_trip_expenses(uuid) from public, anon, authenticated;
grant execute on function public.get_trip_expenses(uuid) to service_role;
