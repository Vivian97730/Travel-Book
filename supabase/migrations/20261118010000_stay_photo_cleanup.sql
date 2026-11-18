-- Retain deletion fences after Storage deletion so late/retried writes cannot
-- attach a photo between the reference check and the remote Storage request.
create table app_private.stay_photo_cleanup (
  trip_id uuid not null references app_private.trips(id) on delete cascade,
  photo_id uuid not null,
  state text not null default 'pending' check (state in ('pending', 'deleting', 'deleted')),
  primary key (trip_id, photo_id)
);
alter table app_private.stay_photo_cleanup enable row level security;
alter table app_private.stay_photo_cleanup force row level security;
revoke all on app_private.stay_photo_cleanup from public, anon, authenticated;

create function app_private.track_stay_photo_cleanup()
returns trigger language plpgsql security definer
set search_path = pg_catalog, app_private
as $$
begin
  if tg_op <> 'DELETE' then
    -- Same lock and ordering as mutate_trip_stay and cleanup claims.
    perform 1 from app_private.resource_versions
      where trip_id = new.trip_id and resource_type = 'stays' for update;
    if new.uploaded_photo_id is not null and exists (
      select 1 from app_private.stay_photo_cleanup
      where trip_id = new.trip_id and photo_id = new.uploaded_photo_id and state <> 'pending'
    ) then
      raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
    end if;
  end if;
  if tg_op <> 'INSERT' then
    -- A trip cascade has already removed its parent; do not block trip deletion
    -- by inserting a new queue row referencing that deleted parent.
    if old.uploaded_photo_id is not null
      and exists (select 1 from app_private.trips where id = old.trip_id) and
      (tg_op = 'DELETE' or old.uploaded_photo_id is distinct from new.uploaded_photo_id) then
      insert into app_private.stay_photo_cleanup(trip_id, photo_id)
        values (old.trip_id, old.uploaded_photo_id) on conflict do nothing;
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function app_private.track_stay_photo_cleanup() from public, anon, authenticated;
create trigger track_stay_photo_cleanup before insert or update or delete on app_private.stays
for each row execute function app_private.track_stay_photo_cleanup();

create function public.claim_stay_photo_cleanup(p_trip_id uuid, p_photo_id uuid default null)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, app_private
as $$
declare
  v_ids uuid[];
begin
  perform 1 from app_private.resource_versions
    where trip_id = p_trip_id and resource_type = 'stays' for update;
  if not found then return '[]'::jsonb; end if;
  if p_photo_id is not null then
    insert into app_private.stay_photo_cleanup(trip_id, photo_id)
      values (p_trip_id, p_photo_id) on conflict do nothing;
  end if;
  select coalesce(array_agg(photo_id), '{}'::uuid[]) into v_ids from (
    select c.photo_id from app_private.stay_photo_cleanup c
    where c.trip_id = p_trip_id
      and (p_photo_id is null or c.photo_id = p_photo_id)
      and (c.state <> 'deleted' or p_photo_id is not null)
      and not exists (select 1 from app_private.stays s
        where s.trip_id = p_trip_id and s.uploaded_photo_id = c.photo_id)
    order by c.photo_id limit 20
  ) candidates;
  update app_private.stay_photo_cleanup set state = 'deleting'
    where trip_id = p_trip_id and photo_id = any(v_ids);
  return to_jsonb(v_ids);
end;
$$;
revoke all on function public.claim_stay_photo_cleanup(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_stay_photo_cleanup(uuid, uuid) to service_role;

create function public.complete_stay_photo_cleanup(p_trip_id uuid, p_photo_ids uuid[])
returns void language sql security definer
set search_path = pg_catalog, app_private
as $$
  update app_private.stay_photo_cleanup set state = 'deleted'
    where trip_id = p_trip_id and photo_id = any(p_photo_ids) and state = 'deleting';
$$;
revoke all on function public.complete_stay_photo_cleanup(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.complete_stay_photo_cleanup(uuid, uuid[]) to service_role;
