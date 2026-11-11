begin;

set local search_path = public, extensions, pg_catalog;
select plan(3);

insert into app_private.trips (id, title, start_date, end_date, display_timezone, traveler_count)
values
  ('ea000000-0000-4000-8000-000000000001', 'Expense test A', '2027-02-05', '2027-02-15', 'Asia/Taipei', 4),
  ('ea000000-0000-4000-8000-000000000002', 'Expense test B', '2027-02-05', '2027-02-15', 'Asia/Taipei', 4);

insert into app_private.exchange_rate_snapshots
  (id, base_currency, rate, source, source_date, formula_version)
values ('ea000000-0000-4000-8000-000000000003', 'EUR', 35.1234567890123456789, 'Fixture', '2027-02-05', 1);

do $$
begin
  insert into app_private.expenses (trip_id, date, title, category, currency, amount_minor,
    rate_snapshot_id, reference_twd_minor)
  values
    ('ea000000-0000-4000-8000-000000000001', '2027-02-06', 'Lunch', '食物', 'TWD', 12050, null, 12050),
    ('ea000000-0000-4000-8000-000000000001', '2027-02-06', 'Tickets', '景點', 'EUR', 100,
      'ea000000-0000-4000-8000-000000000003', 3512),
    ('ea000000-0000-4000-8000-000000000002', '2027-02-06', 'Train', '交通', 'HUF', 860000, null, null);

  assert (select rate = 35.1234567890123456789 from app_private.exchange_rate_snapshots
    where id = 'ea000000-0000-4000-8000-000000000003'), 'rate retains decimal precision';

  begin
    update app_private.expenses set amount_minor = 0 where title = 'Train';
    raise exception 'zero amount was accepted';
  exception when check_violation then null;
  end;
  begin
    update app_private.expenses set reference_twd_minor = null where title = 'Lunch';
    raise exception 'TWD amount without its reference was accepted';
  exception when check_violation then null;
  end;
  begin
    update app_private.expenses set reference_twd_minor = 100 where title = 'Train';
    raise exception 'foreign reference without a snapshot was accepted';
  exception when check_violation then null;
  end;
  begin
    update app_private.expenses set currency = 'HUF' where title = 'Tickets';
    raise exception 'snapshot for the wrong currency was accepted';
  exception when foreign_key_violation then null;
  end;
  begin
    delete from app_private.exchange_rate_snapshots where id = 'ea000000-0000-4000-8000-000000000003';
    raise exception 'linked snapshot was deleted';
  exception when foreign_key_violation then null;
  end;
  begin
    insert into app_private.exchange_rate_snapshots (base_currency, rate, source, source_date, formula_version)
    values ('HUF', 'NaN', 'Fixture', '2027-02-05', 1);
    raise exception 'non-finite rate was accepted';
  exception when check_violation then null;
  end;
end;
$$;
select pass('expense and snapshot constraints');

set local role anon;
do $$
begin
  begin
    perform 1 from app_private.expenses;
    raise exception 'anonymous role read expenses';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from app_private.exchange_rate_snapshots;
    raise exception 'anonymous role read exchange rates';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
select pass('anonymous role cannot read private tables');

set local role authenticated;
do $$
begin
  begin
    perform 1 from app_private.expenses where trip_id in
      ('ea000000-0000-4000-8000-000000000001', 'ea000000-0000-4000-8000-000000000002');
    raise exception 'browser role read private trips';
  exception when insufficient_privilege then null;
  end;
  begin
    update app_private.expenses set amount_minor = 1;
    raise exception 'browser role wrote private trips';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
select pass('authenticated browser role cannot read or write either private trip');

select * from finish();
rollback;
