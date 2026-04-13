-- Remove bundled demo staff (EMP-PP-001, EMP-IE-001, …) and optional name-based markers.
-- Staff rows are normally non-deletable (trigger); this routine disables that trigger briefly.

create or replace function public.purge_sample_staff()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_ids uuid[];
  deleted_pr int := 0;
  deleted_st int := 0;
begin
  select coalesce(
    (
      select array_agg(s.id)
      from public.staff s
      where
        s.employee_code ~ '^EMP-(PP|IE|ASM|RDR|RIDER)-[0-9]+$'
        or s.full_name ilike '%removed sample%'
    ),
    '{}'::uuid[]
  )
  into target_ids;

  if array_length(target_ids, 1) is null then
    return jsonb_build_object(
      'penalty_records_deleted', 0,
      'staff_deleted', 0
    );
  end if;

  with deleted as (
    delete from public.penalty_records pr
    where pr.staff_id = any (target_ids)
    returning id
  )
  select count(*)::int into deleted_pr from deleted;

  update public.staff_import_rows
  set resolved_staff_id = null
  where resolved_staff_id = any (target_ids);

  alter table public.staff disable trigger prevent_staff_delete;

  with deleted as (
    delete from public.staff s
    where s.id = any (target_ids)
    returning id
  )
  select count(*)::int into deleted_st from deleted;

  alter table public.staff enable trigger prevent_staff_delete;

  return jsonb_build_object(
    'penalty_records_deleted', deleted_pr,
    'staff_deleted', deleted_st
  );
end;
$$;

revoke all on function public.purge_sample_staff() from public;
grant execute on function public.purge_sample_staff() to service_role;

-- One-time cleanup for databases that already contain demo rows
select public.purge_sample_staff();
