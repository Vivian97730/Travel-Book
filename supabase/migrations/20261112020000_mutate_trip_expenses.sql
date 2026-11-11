create or replace function public.get_trip_expenses(p_trip_id uuid)
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
        'rateSnapshotId', rate_snapshot_id, 'referenceTwdMinor', reference_twd_minor,
        'snapshotRate', (select rate::text from app_private.exchange_rate_snapshots where id = rate_snapshot_id)
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

create table app_private.expense_mutation_requests (
  trip_id uuid not null references app_private.trips(id) on delete cascade,
  idempotency_key uuid not null,
  request jsonb not null,
  primary key (trip_id, idempotency_key)
);
alter table app_private.expense_mutation_requests enable row level security;
alter table app_private.expense_mutation_requests force row level security;
revoke all on app_private.expense_mutation_requests from public, anon, authenticated;

create function public.mutate_trip_expense(
  p_trip_id uuid, p_action text, p_id uuid, p_input jsonb,
  p_expected_version bigint, p_idempotency_key uuid, p_rate_snapshot_id uuid
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, app_private
as $$
declare
  v_request jsonb := jsonb_build_array(p_action, p_id, p_input, p_expected_version);
  v_previous jsonb;
  v_expense app_private.expenses;
  v_date date;
  v_currency text;
  v_amount bigint;
  v_snapshot uuid;
  v_rate numeric;
  v_reference numeric;
begin
  if p_action is null or p_action not in ('create', 'update', 'delete')
    or p_idempotency_key is null or p_expected_version is null
    or (p_action = 'create' and (p_id is not null or p_expected_version <> 0))
    or (p_action <> 'create' and (p_id is null or p_expected_version < 1)) then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  -- Serialize only requests sharing this receipt key; row versions protect individual expenses.
  perform pg_advisory_xact_lock(hashtextextended(p_trip_id::text || ':' || p_idempotency_key::text, 0));
  if not exists (select 1 from app_private.trips where id = p_trip_id) then
    raise exception using errcode = 'P0002', message = 'RESOURCE_NOT_FOUND';
  end if;
  select request into v_previous from app_private.expense_mutation_requests
    where trip_id = p_trip_id and idempotency_key = p_idempotency_key;
  if found then
    if v_previous is distinct from v_request then
      raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
    end if;
    return public.get_trip_expenses(p_trip_id);
  end if;

  if p_action <> 'create' then
    select * into v_expense from app_private.expenses
      where id = p_id and trip_id = p_trip_id for update;
    if not found then
      raise exception using errcode = 'P0002', message = 'RESOURCE_NOT_FOUND';
    end if;
    if v_expense.version <> p_expected_version then
      raise exception using errcode = 'P0001', message = 'VERSION_CONFLICT';
    end if;
  end if;

  if p_action = 'delete' then
    delete from app_private.expenses where id = p_id and trip_id = p_trip_id;
  else
    v_date := (p_input->>'date')::date;
    v_currency := p_input->>'currency';
    v_amount := (p_input->>'amountMinor')::bigint;
    if v_currency = 'TWD' then
      v_reference := v_amount;
    else
      -- Unchanged date and currency retain the original rate, including a missing rate.
      v_snapshot := case when v_expense.date = v_date and v_expense.currency = v_currency
        then v_expense.rate_snapshot_id else p_rate_snapshot_id end;
      if v_snapshot is not null then
        select rate into v_rate from app_private.exchange_rate_snapshots
          where id = v_snapshot and base_currency = v_currency and source_date <= v_date;
        if not found then
          raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
        end if;
        v_reference := round(v_amount * v_rate);
        if v_reference > 9007199254740991 then
          raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
        end if;
      end if;
    end if;
    if p_action = 'create' then
      insert into app_private.expenses(trip_id, date, title, category, currency, amount_minor, rate_snapshot_id, reference_twd_minor)
      values (p_trip_id, v_date, p_input->>'title', p_input->>'category', v_currency, v_amount, v_snapshot, v_reference);
    else
      update app_private.expenses set date = v_date, title = p_input->>'title', category = p_input->>'category',
        currency = v_currency, amount_minor = v_amount, rate_snapshot_id = v_snapshot,
        reference_twd_minor = v_reference, version = version + 1
      where id = p_id and trip_id = p_trip_id;
    end if;
  end if;
  insert into app_private.expense_mutation_requests values (p_trip_id, p_idempotency_key, v_request);
  return public.get_trip_expenses(p_trip_id);
exception
  when check_violation or invalid_datetime_format or datetime_field_overflow
    or invalid_text_representation or not_null_violation or numeric_value_out_of_range then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
end;
$$;
revoke all on function public.mutate_trip_expense(uuid, text, uuid, jsonb, bigint, uuid, uuid) from public, anon, authenticated;
grant execute on function public.mutate_trip_expense(uuid, text, uuid, jsonb, bigint, uuid, uuid) to service_role;
