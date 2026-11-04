create extension if not exists pgcrypto with schema extensions;

create table app_private.trips (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 120),
  start_date date not null,
  end_date date not null,
  display_timezone text not null check (length(trim(display_timezone)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trips_date_range check (start_date <= end_date)
);

create table app_private.trip_access_tokens (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references app_private.trips(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint trip_access_tokens_revocation_time check (revoked_at is null or revoked_at >= created_at)
);

create unique index trip_access_tokens_one_active_per_trip
  on app_private.trip_access_tokens (trip_id)
  where revoked_at is null;

create table app_private.resource_versions (
  trip_id uuid not null references app_private.trips(id) on delete cascade,
  resource_type text not null check (resource_type ~ '^[a-z][a-z0-9_]{1,49}$'),
  version bigint not null default 1 check (version >= 1),
  updated_at timestamptz not null default now(),
  primary key (trip_id, resource_type)
);

alter table app_private.trips enable row level security;
alter table app_private.trips force row level security;
alter table app_private.trip_access_tokens enable row level security;
alter table app_private.trip_access_tokens force row level security;
alter table app_private.resource_versions enable row level security;
alter table app_private.resource_versions force row level security;

revoke all on app_private.trips, app_private.trip_access_tokens, app_private.resource_versions from public, anon, authenticated;
grant select, insert, update, delete on app_private.trips, app_private.trip_access_tokens, app_private.resource_versions to service_role;

create or replace function public.verify_trip_access(p_token text)
returns table (
  trip_id uuid,
  trip_title text,
  start_date date,
  end_date date,
  display_timezone text,
  resource_versions jsonb
)
language sql
stable
security definer
set search_path = pg_catalog, app_private, extensions
as $$
  select
    trip.id,
    trip.title,
    trip.start_date,
    trip.end_date,
    trip.display_timezone,
    coalesce(
      (
        select jsonb_object_agg(version.resource_type, version.version)
        from app_private.resource_versions as version
        where version.trip_id = trip.id
      ),
      '{}'::jsonb
    )
  from app_private.trip_access_tokens as access
  join app_private.trips as trip on trip.id = access.trip_id
  where access.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and access.revoked_at is null
  limit 1;
$$;

create or replace function public.reset_trip_access_token(p_trip_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = pg_catalog, app_private, extensions
as $$
declare
  generated_token text;
begin
  generated_token := translate(rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='), '+/', '-_');

  update app_private.trip_access_tokens
    set revoked_at = now()
    where trip_id = p_trip_id and revoked_at is null;

  insert into app_private.trip_access_tokens (trip_id, token_hash)
    values (p_trip_id, encode(extensions.digest(generated_token, 'sha256'), 'hex'));

  return generated_token;
end;
$$;

create or replace function public.revoke_trip_access_token(p_token text)
returns boolean
language plpgsql
volatile
security definer
set search_path = pg_catalog, app_private, extensions
as $$
declare
  affected_rows integer;
begin
  update app_private.trip_access_tokens
    set revoked_at = now()
    where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
      and revoked_at is null;
  get diagnostics affected_rows = row_count;
  return affected_rows > 0;
end;
$$;

revoke all on function public.verify_trip_access(text) from public, anon, authenticated;
revoke all on function public.reset_trip_access_token(uuid) from public, anon, authenticated;
revoke all on function public.revoke_trip_access_token(text) from public, anon, authenticated;
grant execute on function public.verify_trip_access(text) to service_role;
grant execute on function public.reset_trip_access_token(uuid) to service_role;
grant execute on function public.revoke_trip_access_token(text) to service_role;
