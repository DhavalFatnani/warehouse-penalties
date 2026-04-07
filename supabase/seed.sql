insert into public.staff_types (code, display_name, sort_order)
values
  ('PP', 'PP', 1),
  ('IE', 'IE', 2),
  ('ASM', 'ASM', 3),
  ('RIDER', 'Rider', 4)
on conflict (code) do update set
  display_name = excluded.display_name,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.warehouses (code, name, is_active)
values ('DEFAULT', 'Default Warehouse', true)
on conflict (code) do nothing;
