create table app_private.exchange_rate_snapshots (
  id uuid primary key default gen_random_uuid(),
  base_currency text not null check (base_currency in ('EUR', 'HUF')),
  quote_currency text not null default 'TWD' check (quote_currency = 'TWD'),
  rate numeric not null check (rate > 0 and rate < 'Infinity'::numeric),
  source text not null check (length(trim(source)) > 0),
  source_date date not null check (isfinite(source_date)),
  fetched_at timestamptz not null default now() check (isfinite(fetched_at)),
  formula_version integer not null check (formula_version > 0),
  unique (id, base_currency),
  unique (base_currency, source_date, formula_version)
);

create table app_private.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references app_private.trips(id) on delete cascade,
  date date not null check (isfinite(date)),
  title text not null check (length(trim(title)) between 1 and 50),
  category text not null check (category in ('食物', '交通', '景點', '逛街', '超市', '機票')),
  currency text not null check (currency in ('TWD', 'EUR', 'HUF')),
  amount_minor bigint not null check (amount_minor between 1 and 9007199254740991),
  rate_snapshot_id uuid,
  reference_twd_minor bigint check (reference_twd_minor between 0 and 9007199254740991),
  version bigint not null default 1 check (version between 1 and 9007199254740991),
  foreign key (rate_snapshot_id, currency)
    references app_private.exchange_rate_snapshots(id, base_currency),
  constraint expenses_conversion check (
    (currency = 'TWD' and rate_snapshot_id is null
      and reference_twd_minor is not null and reference_twd_minor = amount_minor)
    or
    (currency in ('EUR', 'HUF') and (rate_snapshot_id is null) = (reference_twd_minor is null))
  )
);

create index expenses_trip_date_idx on app_private.expenses(trip_id, date, id);

alter table app_private.expenses enable row level security;
alter table app_private.expenses force row level security;
alter table app_private.exchange_rate_snapshots enable row level security;
alter table app_private.exchange_rate_snapshots force row level security;

revoke all on app_private.expenses, app_private.exchange_rate_snapshots from public, anon, authenticated;
grant select, insert, update, delete on app_private.expenses to service_role;
grant select, insert on app_private.exchange_rate_snapshots to service_role;
