-- RLS helpers
create or replace function public.current_app_role()
returns text
language sql
stable
as $$
  select role::text
  from public.users
  where auth_user_id = auth.uid()
  limit 1
$$;

create or replace function public.is_manager_or_admin()
returns boolean
language sql
stable
as $$
  select coalesce(public.current_app_role() in ('manager', 'admin'), false)
$$;

-- Enable RLS on client-accessed tables/views.
alter table public.users enable row level security;
alter table public.warehouses enable row level security;
alter table public.staff_types enable row level security;
alter table public.staff enable row level security;
alter table public.penalty_definitions enable row level security;
alter table public.penalty_definition_staff_types enable row level security;
alter table public.penalty_structure_tiers enable row level security;
alter table public.penalty_records enable row level security;
alter table public.staff_import_batches enable row level security;
alter table public.staff_import_rows enable row level security;
alter table public.audit_log enable row level security;
alter table public.penalty_attachments enable row level security;

-- users
create policy users_self_or_admin_select
on public.users
for select
using (auth_user_id = auth.uid() or public.current_app_role() = 'admin');

create policy users_admin_write
on public.users
for all
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

-- Manager/app-access tables (manager/admin read+write)
create policy warehouses_manager_rw on public.warehouses
for all using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());
create policy staff_types_manager_rw on public.staff_types
for all using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());
create policy staff_manager_rw on public.staff
for all using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());
create policy penalty_definitions_manager_rw on public.penalty_definitions
for all using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());
create policy penalty_definition_staff_types_manager_rw on public.penalty_definition_staff_types
for all using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());
create policy penalty_structure_tiers_manager_rw on public.penalty_structure_tiers
for all using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());
create policy penalty_records_manager_rw on public.penalty_records
for all using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());
create policy staff_import_batches_manager_rw on public.staff_import_batches
for all using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());
create policy staff_import_rows_manager_rw on public.staff_import_rows
for all using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());
create policy penalty_attachments_manager_rw on public.penalty_attachments
for all using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());
create policy audit_log_admin_only on public.audit_log
for all using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');
