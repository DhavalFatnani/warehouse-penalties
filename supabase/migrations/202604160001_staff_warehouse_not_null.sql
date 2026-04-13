-- Every staff row must belong to a warehouse (application + DB invariant).

update public.staff s
set warehouse_id = w.id
from (
  select id
  from public.warehouses
  where is_active = true
  order by code asc
  limit 1
) w
where s.warehouse_id is null
  and exists (select 1 from public.warehouses where is_active = true limit 1);

alter table public.staff alter column warehouse_id set not null;
