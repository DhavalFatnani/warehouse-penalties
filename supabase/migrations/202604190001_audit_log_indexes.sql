-- Indexes to support the common query patterns on audit_log:
--   1. Filter by actor (changed_by_user_id) ordered by most recent first
--   2. Date-range scans ordered by most recent first (no other filters)
-- The existing idx_audit_log_entity_time covers entity_type+entity_id lookups.

create index if not exists idx_audit_log_actor_time
  on public.audit_log (changed_by_user_id, changed_at desc)
  where changed_by_user_id is not null;

create index if not exists idx_audit_log_changed_at
  on public.audit_log (changed_at desc);
