-- Warehouse-level access for managers + transactional staff import commit

create table if not exists public.user_warehouse_access (
  user_id uuid not null references public.users(id) on delete cascade,
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, warehouse_id)
);

create index if not exists idx_user_warehouse_access_warehouse
  on public.user_warehouse_access (warehouse_id);

alter table public.staff_import_batches
  add column if not exists warehouse_id uuid references public.warehouses(id) on delete set null;

create index if not exists idx_staff_import_batches_warehouse
  on public.staff_import_batches (warehouse_id);

-- Resolve current app user from JWT
create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.users where auth_user_id = auth.uid() limit 1
$$;

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where auth_user_id = auth.uid() and role = 'admin'
  )
$$;

create or replace function public.manager_has_warehouse(p_warehouse_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_warehouse_id is null then public.is_app_admin()
    when public.is_app_admin() then true
    else exists (
      select 1
      from public.user_warehouse_access uwa
      join public.users u on u.id = uwa.user_id
      where u.auth_user_id = auth.uid()
        and uwa.warehouse_id = p_warehouse_id
    )
  end
$$;

-- Grant default warehouse access to existing manager users (seed-friendly)
insert into public.user_warehouse_access (user_id, warehouse_id)
select u.id, w.id
from public.users u
cross join public.warehouses w
where w.code = 'DEFAULT'
  and u.role = 'manager'
on conflict do nothing;

-- RLS: replace broad manager policies with warehouse-scoped policies
drop policy if exists staff_manager_rw on public.staff;
drop policy if exists penalty_records_manager_rw on public.penalty_records;
drop policy if exists staff_import_batches_manager_rw on public.staff_import_batches;
drop policy if exists staff_import_rows_manager_rw on public.staff_import_rows;

create policy staff_manager_scoped on public.staff
for all
using (
  public.is_app_admin()
  or public.manager_has_warehouse(staff.warehouse_id)
)
with check (
  public.is_app_admin()
  or public.manager_has_warehouse(staff.warehouse_id)
);

create policy penalty_records_manager_scoped on public.penalty_records
for all
using (
  public.is_app_admin()
  or public.manager_has_warehouse(
    coalesce(
      penalty_records.warehouse_id,
      (select s.warehouse_id from public.staff s where s.id = penalty_records.staff_id)
    )
  )
)
with check (
  public.is_app_admin()
  or public.manager_has_warehouse(
    coalesce(
      penalty_records.warehouse_id,
      (select s.warehouse_id from public.staff s where s.id = penalty_records.staff_id)
    )
  )
);

create policy staff_import_batches_manager_scoped on public.staff_import_batches
for all
using (
  public.is_app_admin()
  or (
    staff_import_batches.warehouse_id is not null
    and public.manager_has_warehouse(staff_import_batches.warehouse_id)
  )
)
with check (
  public.is_app_admin()
  or (
    staff_import_batches.warehouse_id is not null
    and public.manager_has_warehouse(staff_import_batches.warehouse_id)
  )
);

create policy staff_import_rows_manager_scoped on public.staff_import_rows
for all
using (
  public.is_app_admin()
  or exists (
    select 1
    from public.staff_import_batches b
    where b.id = staff_import_rows.batch_id
      and b.warehouse_id is not null
      and public.manager_has_warehouse(b.warehouse_id)
  )
)
with check (
  public.is_app_admin()
  or exists (
    select 1
    from public.staff_import_batches b
    where b.id = staff_import_rows.batch_id
      and b.warehouse_id is not null
      and public.manager_has_warehouse(b.warehouse_id)
  )
);

-- RLS for user_warehouse_access: users see own rows; admin all
alter table public.user_warehouse_access enable row level security;

create policy user_warehouse_access_self on public.user_warehouse_access
for select
using (
  exists (
    select 1 from public.users u
    where u.id = user_warehouse_access.user_id
      and u.auth_user_id = auth.uid()
  )
  or public.is_app_admin()
);

create policy user_warehouse_access_admin_write on public.user_warehouse_access
for all
using (public.is_app_admin())
with check (public.is_app_admin());

-- Transactional commit: stage rows + upsert staff + finalize batch (single transaction)
create or replace function public.commit_staff_import_batch(
  p_batch_id uuid,
  p_warehouse_id uuid,
  p_rows jsonb,
  p_default_staff_type text default 'PP'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  elem jsonb;
  v_row_num int;
  v_raw jsonb;
  v_status text;
  v_errors jsonb;
  v_emp text;
  v_name text;
  v_type_code text;
  v_staff_type_id uuid;
  v_valid int := 0;
  v_invalid int := 0;
  v_committed int := 0;
  v_total int := 0;
begin
  if p_batch_id is null or p_warehouse_id is null then
    raise exception 'batch_id and warehouse_id are required';
  end if;

  update public.staff_import_batches
  set warehouse_id = p_warehouse_id,
      status = 'validating'
  where id = p_batch_id;

  delete from public.staff_import_rows where batch_id = p_batch_id;

  for elem in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    v_total := v_total + 1;
    v_row_num := (elem->>'row_number')::int;
    v_raw := elem->'raw';
    v_status := elem->>'validation_status';
    v_errors := elem->'validation_errors';

    insert into public.staff_import_rows (
      batch_id, row_number, raw_payload, normalized_employee_code,
      validation_status, validation_errors
    )
    values (
      p_batch_id,
      v_row_num,
      coalesce(v_raw, '{}'::jsonb),
      nullif(trim(v_raw->>'employee_code'), ''),
      v_status::public.import_row_status,
      v_errors
    );

    if v_status = 'valid' then
      v_valid := v_valid + 1;
      v_emp := trim(v_raw->>'employee_code');
      v_name := trim(v_raw->>'full_name');
      v_type_code := upper(coalesce(nullif(trim(v_raw->>'staff_type_code'), ''), p_default_staff_type));

      select id into v_staff_type_id
      from public.staff_types
      where code = v_type_code
      limit 1;

      if v_staff_type_id is null then
        v_valid := v_valid - 1;
        v_invalid := v_invalid + 1;
        update public.staff_import_rows
        set
          validation_status = 'invalid'::public.import_row_status,
          validation_errors = jsonb_build_object('code', 'unknown_staff_type', 'staff_type_code', v_type_code)
        where batch_id = p_batch_id and row_number = v_row_num;
        continue;
      end if;

      insert into public.staff (
        warehouse_id, staff_type_id, employee_code, full_name, external_ref, is_active
      )
      values (
        p_warehouse_id,
        v_staff_type_id,
        v_emp,
        v_name,
        nullif(trim(v_raw->>'external_ref'), ''),
        true
      )
      on conflict (warehouse_id, employee_code) do update set
        staff_type_id = excluded.staff_type_id,
        full_name = excluded.full_name,
        external_ref = excluded.external_ref,
        is_active = excluded.is_active,
        updated_at = now();

      v_committed := v_committed + 1;
    else
      v_invalid := v_invalid + 1;
    end if;
  end loop;

  update public.staff_import_batches
  set
    total_rows = v_total,
    valid_rows = v_valid,
    committed_rows = v_committed,
    status = case
      when v_total = 0 then 'failed'::public.import_batch_status
      when v_invalid = 0 then 'committed'::public.import_batch_status
      else 'partial'::public.import_batch_status
    end,
    completed_at = now()
  where id = p_batch_id;

  return jsonb_build_object(
    'total_rows', v_total,
    'valid_rows', v_valid,
    'invalid_rows', v_invalid,
    'committed_rows', v_committed
  );
end;
$$;

revoke all on function public.commit_staff_import_batch(uuid, uuid, jsonb, text) from public;
grant execute on function public.commit_staff_import_batch(uuid, uuid, jsonb, text) to service_role;
