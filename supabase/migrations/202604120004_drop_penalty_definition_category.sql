-- Remove penalty_definitions.category (UI no longer collects it).

drop view if exists public.v_penalty_records_with_staff;

drop index if exists public.idx_penalty_definitions_active_category_title;
drop index if exists public.idx_penalty_definitions_active_category;

alter table public.penalty_definitions drop column if exists category;

create view public.v_penalty_records_with_staff as
select
  pr.id,
  pr.incident_date,
  pr.recorded_at,
  pr.status,
  pr.settled_at,
  pr.proof_url,
  pr.computed_amount,
  pr.computed_points,
  pr.occurrence_index,
  pr.manual_override,
  pr.notes,
  pr.staff_id,
  s.employee_code,
  s.full_name as staff_full_name,
  st.code as staff_type_code,
  st.display_name as staff_type_name,
  pr.penalty_definition_id,
  pc.code as penalty_code,
  pd.title as penalty_title,
  pr.warehouse_id,
  w.code as warehouse_code,
  w.name as warehouse_name,
  pr.recorded_by_user_id,
  s.staff_type_id
from public.penalty_records pr
join public.staff s on s.id = pr.staff_id
join public.staff_types st on st.id = s.staff_type_id
join public.penalty_definitions pd on pd.id = pr.penalty_definition_id
join public.penalty_codes pc on pc.id = pd.penalty_code_id
left join public.warehouses w on w.id = pr.warehouse_id;

alter view public.v_penalty_records_with_staff set (security_invoker = true);
