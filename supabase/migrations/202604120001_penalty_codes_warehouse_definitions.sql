-- Catalog of penalty codes (managed separately); definitions reference codes and optional warehouse scope.

create table public.penalty_codes (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid references public.warehouses (id) on delete cascade,
  code text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint penalty_codes_code_nonempty check (char_length(trim(code)) >= 1)
);

create index idx_penalty_codes_warehouse on public.penalty_codes (warehouse_id);

create unique index penalty_codes_global_upper_uniq
  on public.penalty_codes (upper(trim(code)))
  where warehouse_id is null;

create unique index penalty_codes_wh_upper_uniq
  on public.penalty_codes (warehouse_id, upper(trim(code)))
  where warehouse_id is not null;

create trigger set_timestamp_penalty_codes
before update on public.penalty_codes
for each row execute function public.tg_set_timestamp();

alter table public.penalty_definitions
  add column penalty_code_id uuid references public.penalty_codes (id) on delete restrict,
  add column warehouse_id uuid references public.warehouses (id) on delete set null;

-- Backfill global codes from existing definition codes
insert into public.penalty_codes (warehouse_id, code)
select null, upper(trim(code))
from public.penalty_definitions
group by upper(trim(code));

update public.penalty_definitions pd
set penalty_code_id = pc.id
from public.penalty_codes pc
where pc.warehouse_id is null
  and upper(trim(pc.code)) = upper(trim(pd.code));

alter table public.penalty_definitions
  alter column penalty_code_id set not null;

alter table public.penalty_definitions
  drop constraint if exists penalty_definitions_code_key;

-- View references pd.code; must drop before removing the column.
drop view if exists public.v_penalty_records_with_staff;

alter table public.penalty_definitions
  drop column code;

-- One definition per (warehouse scope, catalog code)
create unique index penalty_definitions_wh_penalty_code_uniq
  on public.penalty_definitions (warehouse_id, penalty_code_id)
  where warehouse_id is not null;

create unique index penalty_definitions_global_penalty_code_uniq
  on public.penalty_definitions (penalty_code_id)
  where warehouse_id is null;

create index idx_penalty_definitions_warehouse on public.penalty_definitions (warehouse_id);

-- Reporting view: code from catalog (view was dropped above before column removal)
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
  pd.category as penalty_category,
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

alter table public.penalty_codes enable row level security;

create policy penalty_codes_manager_rw on public.penalty_codes
for all using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());
