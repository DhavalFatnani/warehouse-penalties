-- Settlement lifecycle: CREATED / SETTLED (replaces draft/confirmed/appealed/revoked model)

drop view if exists public.v_staff_penalty_summary;
drop view if exists public.v_penalty_records_with_staff;

create type public.penalty_record_status as enum ('created', 'settled');

alter table public.penalty_definitions
  add column if not exists default_amount numeric(12,2);

alter table public.penalty_records
  add column if not exists settled_at timestamptz,
  add column if not exists proof_url text;

alter table public.penalty_records
  add column if not exists status_new public.penalty_record_status;

update public.penalty_records
set status_new = case
  when status::text = 'revoked' then 'settled'::public.penalty_record_status
  else 'created'::public.penalty_record_status
end
where status_new is null;

update public.penalty_records
set settled_at = coalesce(revoked_at, now())
where status_new = 'settled'::public.penalty_record_status
  and settled_at is null;

alter table public.penalty_records
  drop constraint if exists penalty_records_confirmed_values_chk;

alter table public.penalty_records
  drop constraint if exists penalty_records_revoked_consistency_chk;

drop index if exists public.idx_penalty_records_confirmed_staff_incident;
drop index if exists public.idx_penalty_records_confirmed_warehouse_incident;

alter table public.penalty_records drop column if exists status;

alter table public.penalty_records
  drop column if exists appeal_notes,
  drop column if exists revoked_at,
  drop column if exists revoked_by_user_id,
  drop column if exists revocation_reason;

alter table public.penalty_records rename column status_new to status;

alter table public.penalty_records
  alter column status set not null,
  alter column status set default 'created'::public.penalty_record_status;

drop type public.penalty_status;

alter table public.penalty_records
  add constraint penalty_records_settled_at_chk
  check (status <> 'settled' or settled_at is not null);

create index idx_penalty_records_created_staff_incident
  on public.penalty_records (staff_id, incident_date desc)
  where status = 'created';

create index idx_penalty_records_created_warehouse_incident
  on public.penalty_records (warehouse_id, incident_date desc)
  where status = 'created';

create or replace function public.tg_penalty_record_settled_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'settled'::public.penalty_record_status then
    new.settled_at = coalesce(new.settled_at, now());
  else
    new.settled_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists set_penalty_record_settled_at on public.penalty_records;
create trigger set_penalty_record_settled_at
before insert or update on public.penalty_records
for each row execute function public.tg_penalty_record_settled_at();

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
    and pr.status in ('created'::public.penalty_record_status, 'settled'::public.penalty_record_status)
    and (ss.start_date is null or pr.incident_date >= ss.start_date)
    and pr.incident_date <= p_incident_date;
$$;

create or replace view public.v_penalty_records_with_staff as
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

alter view public.v_penalty_records_with_staff set (security_invoker = true);

create or replace view public.v_staff_penalty_summary as
select
  s.id as staff_id,
  s.full_name as staff_full_name,
  s.employee_code,
  s.warehouse_id,
  s.staff_type_id,
  count(*) filter (where pr.status = 'created'::public.penalty_record_status) as open_count,
  count(*) filter (where pr.status = 'settled'::public.penalty_record_status) as settled_count,
  coalesce(sum(pr.computed_amount) filter (where pr.status = 'created'::public.penalty_record_status), 0)::numeric(12,2) as open_amount_total,
  coalesce(sum(pr.computed_amount) filter (where pr.status = 'settled'::public.penalty_record_status), 0)::numeric(12,2) as settled_amount_total,
  max(pr.incident_date) as last_incident_date
from public.staff s
left join public.penalty_records pr on pr.staff_id = s.id
group by s.id, s.full_name, s.employee_code, s.warehouse_id, s.staff_type_id;

alter view public.v_staff_penalty_summary set (security_invoker = true);

insert into storage.buckets (id, name, public)
values ('penalty-attachments', 'penalty-attachments', true)
on conflict (id) do nothing;
