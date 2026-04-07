-- Run after loading seed/sample data.
-- Example:
-- psql "$SUPABASE_DB_URL" -f supabase/tests/query_plans.sql

-- 1) Staff timeline query (uses staff + incident indexes)
explain (analyze, buffers)
with params as (
  select id as staff_id
  from public.staff
  order by created_at
  limit 1
)
select id, incident_date, computed_amount, status, penalty_definition_id
from public.penalty_records
where staff_id = (select staff_id from params)
order by incident_date desc
limit 50;

-- 2) Warehouse date-range query (uses warehouse/date + partial created index)
explain (analyze, buffers)
with params as (
  select id as warehouse_id
  from public.warehouses
  order by created_at
  limit 1
)
select id, incident_date, computed_amount, status
from public.penalty_records
where warehouse_id = (select warehouse_id from params)
  and incident_date between current_date - 365 and current_date
  and status = 'created'
order by incident_date desc
limit 100;

-- 3) Occurrence counter query (uses staff + definition + date index)
explain (analyze, buffers)
with params as (
  select
    pr.staff_id,
    pr.penalty_definition_id
  from public.penalty_records pr
  where pr.status in ('created', 'settled')
  order by pr.created_at
  limit 1
)
select count(*) as occurrence_count
from public.penalty_records
where staff_id = (select staff_id from params)
  and penalty_definition_id = (select penalty_definition_id from params)
  and incident_date >= current_date - 365
  and incident_date <= current_date
  and status in ('created', 'settled');

-- 4) Shared list view query
explain (analyze, buffers)
with params as (
  select id as warehouse_id
  from public.warehouses
  order by created_at
  limit 1
)
select *
from public.v_penalty_records_with_staff
where warehouse_id = (select warehouse_id from params)
order by incident_date desc
limit 100;
