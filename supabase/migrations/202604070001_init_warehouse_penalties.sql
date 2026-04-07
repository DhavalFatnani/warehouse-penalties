create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create type public.user_role as enum ('manager', 'admin');
create type public.penalty_status as enum ('draft', 'confirmed', 'appealed', 'revoked');
create type public.structure_model as enum (
  'fixed_per_occurrence',
  'tiered_per_occurrence',
  'linear_escalation',
  'bracket_cumulative'
);
create type public.occurrence_scope as enum (
  'all_time',
  'rolling_window',
  'calendar_month',
  'calendar_quarter'
);
create type public.import_batch_status as enum (
  'pending',
  'validating',
  'committed',
  'failed',
  'partial'
);
create type public.import_row_status as enum ('pending', 'valid', 'invalid');

create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.staff_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  display_name text not null,
  sort_order int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  email text not null unique,
  full_name text not null,
  role public.user_role not null default 'manager',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_auth_user_id_fkey
    foreign key (auth_user_id) references auth.users(id) on delete set null
);

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid references public.warehouses(id) on delete restrict,
  staff_type_id uuid not null references public.staff_types(id) on delete restrict,
  employee_code text not null,
  external_ref text,
  full_name text not null,
  is_active boolean not null default true,
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_warehouse_employee_code_uniq unique (warehouse_id, employee_code),
  constraint staff_warehouse_external_ref_uniq unique (warehouse_id, external_ref)
);

create table public.penalty_definitions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  category text not null,
  severity smallint,
  structure_model public.structure_model not null,
  occurrence_scope public.occurrence_scope not null,
  structure_config jsonb,
  is_active boolean not null default true,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint penalty_definitions_severity_chk
    check (severity is null or severity between 1 and 5)
);

create table public.penalty_definition_staff_types (
  penalty_definition_id uuid not null references public.penalty_definitions(id) on delete cascade,
  staff_type_id uuid not null references public.staff_types(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (penalty_definition_id, staff_type_id)
);

create table public.penalty_structure_tiers (
  id uuid primary key default gen_random_uuid(),
  penalty_definition_id uuid not null references public.penalty_definitions(id) on delete cascade,
  sort_order int not null,
  from_occurrence int not null,
  to_occurrence int,
  amount numeric(12,2),
  points int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint penalty_structure_tiers_range_chk
    check (
      from_occurrence >= 1 and
      (to_occurrence is null or to_occurrence >= from_occurrence)
    ),
  constraint penalty_structure_tiers_values_chk
    check (amount is not null or points is not null),
  constraint penalty_structure_tiers_sort_order_uniq unique (penalty_definition_id, sort_order)
);

create table public.penalty_records (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete restrict,
  penalty_definition_id uuid not null references public.penalty_definitions(id) on delete restrict,
  warehouse_id uuid references public.warehouses(id) on delete set null,
  incident_date date not null,
  recorded_at timestamptz not null default now(),
  recorded_by_user_id uuid not null references public.users(id) on delete restrict,
  occurrence_index int,
  computed_amount numeric(12,2),
  computed_points int,
  structure_snapshot jsonb,
  manual_override boolean not null default false,
  notes text,
  status public.penalty_status not null default 'draft',
  appeal_notes text,
  revoked_at timestamptz,
  revoked_by_user_id uuid references public.users(id) on delete set null,
  revocation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint penalty_records_occurrence_index_chk check (occurrence_index is null or occurrence_index >= 1),
  constraint penalty_records_confirmed_values_chk
    check (
      status <> 'confirmed'
      or (
        occurrence_index is not null and
        (computed_amount is not null or computed_points is not null) and
        structure_snapshot is not null
      )
    ),
  constraint penalty_records_revoked_consistency_chk
    check (
      (status <> 'revoked' and revoked_at is null and revoked_by_user_id is null and revocation_reason is null)
      or
      (status = 'revoked' and revoked_at is not null and revoked_by_user_id is not null)
    )
);

create table public.penalty_attachments (
  id uuid primary key default gen_random_uuid(),
  penalty_record_id uuid not null references public.penalty_records(id) on delete cascade,
  storage_bucket text not null default 'penalty-attachments',
  storage_path text not null,
  mime_type text,
  uploaded_at timestamptz not null default now(),
  uploaded_by_user_id uuid references public.users(id) on delete set null
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  changed_by_user_id uuid references public.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  old_values jsonb,
  new_values jsonb
);

create table public.staff_import_batches (
  id uuid primary key default gen_random_uuid(),
  uploaded_by_user_id uuid references public.users(id) on delete set null,
  source_filename text,
  status public.import_batch_status not null default 'pending',
  total_rows int not null default 0,
  valid_rows int,
  committed_rows int,
  error_summary jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.staff_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.staff_import_batches(id) on delete cascade,
  row_number int not null,
  raw_payload jsonb not null,
  normalized_employee_code text,
  resolved_staff_id uuid references public.staff(id) on delete set null,
  validation_status public.import_row_status not null default 'pending',
  validation_errors jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_import_rows_batch_row_uniq unique (batch_id, row_number)
);

create or replace function public.tg_set_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.tg_staff_deactivation_timestamp()
returns trigger
language plpgsql
as $$
begin
  if old.is_active = true and new.is_active = false then
    new.deactivated_at = coalesce(new.deactivated_at, now());
  elsif new.is_active = true then
    new.deactivated_at = null;
  end if;
  return new;
end;
$$;

create or replace function public.tg_prevent_staff_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'staff records cannot be deleted; use is_active=false';
end;
$$;

create trigger set_timestamp_warehouses
before update on public.warehouses
for each row execute function public.tg_set_timestamp();

create trigger set_timestamp_staff_types
before update on public.staff_types
for each row execute function public.tg_set_timestamp();

create trigger set_timestamp_users
before update on public.users
for each row execute function public.tg_set_timestamp();

create trigger set_timestamp_staff
before update on public.staff
for each row execute function public.tg_set_timestamp();

create trigger set_deactivation_timestamp_staff
before update on public.staff
for each row execute function public.tg_staff_deactivation_timestamp();

create trigger prevent_staff_delete
before delete on public.staff
for each row execute function public.tg_prevent_staff_delete();

create trigger set_timestamp_penalty_definitions
before update on public.penalty_definitions
for each row execute function public.tg_set_timestamp();

create trigger set_timestamp_penalty_structure_tiers
before update on public.penalty_structure_tiers
for each row execute function public.tg_set_timestamp();

create trigger set_timestamp_penalty_records
before update on public.penalty_records
for each row execute function public.tg_set_timestamp();

create trigger set_timestamp_staff_import_rows
before update on public.staff_import_rows
for each row execute function public.tg_set_timestamp();

create or replace function public.get_penalty_occurrence_count(
  p_staff_id uuid,
  p_penalty_definition_id uuid,
  p_incident_date date,
  p_occurrence_scope public.occurrence_scope,
  p_structure_config jsonb default '{}'::jsonb
)
returns int
language sql
stable
as $$
  with scope_start as (
    select case
      when p_occurrence_scope = 'all_time' then null::date
      when p_occurrence_scope = 'rolling_window' then (p_incident_date - coalesce((p_structure_config->>'window_days')::int, 30))
      when p_occurrence_scope = 'calendar_month' then date_trunc('month', p_incident_date::timestamp)::date
      when p_occurrence_scope = 'calendar_quarter' then date_trunc('quarter', p_incident_date::timestamp)::date
      else null::date
    end as start_date
  )
  select count(*)::int
  from public.penalty_records pr
  cross join scope_start ss
  where pr.staff_id = p_staff_id
    and pr.penalty_definition_id = p_penalty_definition_id
    and pr.status = 'confirmed'
    and pr.revoked_at is null
    and (ss.start_date is null or pr.incident_date >= ss.start_date)
    and pr.incident_date <= p_incident_date;
$$;

-- Foreign key and query indexes (production baseline).
create index idx_staff_warehouse_stafftype_active
  on public.staff (warehouse_id, staff_type_id, is_active);
create index idx_staff_warehouse_active
  on public.staff (warehouse_id, is_active);
create index idx_staff_staff_type on public.staff (staff_type_id);
create index idx_staff_full_name_trgm on public.staff using gin (full_name gin_trgm_ops);

create index idx_penalty_definition_staff_types_staff_type
  on public.penalty_definition_staff_types (staff_type_id);
create index idx_penalty_structure_tiers_definition
  on public.penalty_structure_tiers (penalty_definition_id);

create index idx_penalty_records_staff_incident
  on public.penalty_records (staff_id, incident_date desc);
create index idx_penalty_records_staff_recorded
  on public.penalty_records (staff_id, recorded_at desc);
create index idx_penalty_records_warehouse_incident
  on public.penalty_records (warehouse_id, incident_date desc);
create index idx_penalty_records_recorded_by
  on public.penalty_records (recorded_by_user_id, recorded_at desc);
create index idx_penalty_records_definition
  on public.penalty_records (penalty_definition_id);
create index idx_penalty_records_staff_definition_incident
  on public.penalty_records (staff_id, penalty_definition_id, incident_date);
create index idx_penalty_records_status
  on public.penalty_records (status);
create index idx_penalty_records_confirmed_staff_incident
  on public.penalty_records (staff_id, incident_date desc)
  where status = 'confirmed';
create index idx_penalty_records_confirmed_warehouse_incident
  on public.penalty_records (warehouse_id, incident_date desc)
  where status = 'confirmed';
create index idx_penalty_records_staff_incident_cover
  on public.penalty_records (staff_id, incident_date desc)
  include (computed_amount, computed_points, status, penalty_definition_id);

create index idx_penalty_attachments_penalty_record
  on public.penalty_attachments (penalty_record_id);
create index idx_audit_log_entity_time
  on public.audit_log (entity_type, entity_id, changed_at desc);

create index idx_staff_import_batches_status
  on public.staff_import_batches (status, created_at desc);
create index idx_staff_import_rows_batch
  on public.staff_import_rows (batch_id, row_number);
create index idx_staff_import_rows_resolved_staff
  on public.staff_import_rows (resolved_staff_id);
create index idx_staff_import_rows_validation_status
  on public.staff_import_rows (validation_status);

create index idx_penalty_definitions_active_category_title
  on public.penalty_definitions (category, title)
  where is_active = true;
create index idx_penalty_definitions_active_category
  on public.penalty_definitions (is_active, category);

-- Thin query views for shared API/export reads.
create or replace view public.v_penalty_records_with_staff as
select
  pr.id,
  pr.incident_date,
  pr.recorded_at,
  pr.status,
  pr.computed_amount,
  pr.computed_points,
  pr.occurrence_index,
  pr.manual_override,
  pr.staff_id,
  s.employee_code,
  s.full_name as staff_full_name,
  st.code as staff_type_code,
  st.display_name as staff_type_name,
  pr.penalty_definition_id,
  pd.code as penalty_code,
  pd.title as penalty_title,
  pd.category as penalty_category,
  pr.warehouse_id,
  w.code as warehouse_code,
  w.name as warehouse_name,
  pr.recorded_by_user_id
from public.penalty_records pr
join public.staff s on s.id = pr.staff_id
join public.staff_types st on st.id = s.staff_type_id
join public.penalty_definitions pd on pd.id = pr.penalty_definition_id
left join public.warehouses w on w.id = pr.warehouse_id;

create or replace view public.v_staff_penalty_summary as
select
  s.id as staff_id,
  s.full_name as staff_full_name,
  s.employee_code,
  s.warehouse_id,
  s.staff_type_id,
  count(*) filter (where pr.status = 'confirmed') as confirmed_count,
  count(*) filter (where pr.status = 'revoked') as revoked_count,
  coalesce(sum(pr.computed_amount) filter (where pr.status = 'confirmed'), 0)::numeric(12,2) as confirmed_amount_total,
  coalesce(sum(pr.computed_points) filter (where pr.status = 'confirmed'), 0)::int as confirmed_points_total,
  max(pr.incident_date) as last_incident_date
from public.staff s
left join public.penalty_records pr on pr.staff_id = s.id
group by s.id, s.full_name, s.employee_code, s.warehouse_id, s.staff_type_id;
