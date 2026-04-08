-- Staff phone + import RPC without default staff type (CSV must include staff_type_code).

alter table public.staff add column if not exists phone text;

drop function if exists public.commit_staff_import_batch(uuid, uuid, jsonb, text);

create or replace function public.commit_staff_import_batch(
  p_batch_id uuid,
  p_warehouse_id uuid,
  p_rows jsonb
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
  v_phone text;
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
      v_type_code := upper(nullif(trim(v_raw->>'staff_type_code'), ''));
      v_phone := nullif(trim(v_raw->>'phone'), '');

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
        warehouse_id, staff_type_id, employee_code, full_name, external_ref, phone, is_active
      )
      values (
        p_warehouse_id,
        v_staff_type_id,
        v_emp,
        v_name,
        nullif(trim(v_raw->>'external_ref'), ''),
        v_phone,
        true
      )
      on conflict (warehouse_id, employee_code) do update set
        staff_type_id = excluded.staff_type_id,
        full_name = excluded.full_name,
        external_ref = excluded.external_ref,
        phone = coalesce(excluded.phone, public.staff.phone),
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

revoke all on function public.commit_staff_import_batch(uuid, uuid, jsonb) from public;
grant execute on function public.commit_staff_import_batch(uuid, uuid, jsonb) to service_role;
