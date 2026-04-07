-- Ensure every penalty definition has at least one staff-type mapping (legacy rows had none).
insert into public.penalty_definition_staff_types (penalty_definition_id, staff_type_id)
select pd.id, st.id
from public.penalty_definitions pd
cross join public.staff_types st
where not exists (
  select 1
  from public.penalty_definition_staff_types x
  where x.penalty_definition_id = pd.id
)
on conflict do nothing;
