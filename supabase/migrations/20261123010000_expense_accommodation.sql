-- Extend the category constraint without changing existing expenses.
alter table app_private.expenses drop constraint expenses_category_check;
alter table app_private.expenses add constraint expenses_category_check
  check (category in ('食物', '交通', '景點', '逛街', '超市', '住宿', '機票'));
