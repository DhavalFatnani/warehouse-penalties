-- Clear operational data to start fresh.
-- Keeps master/config data like users, warehouses, staff_types.
--
-- One TRUNCATE listing all FK-related tables: Postgres rejects separate
-- TRUNCATEs on a referenced table (e.g. penalty_records) when another
-- table has a foreign key to it, even if the child is already empty.

truncate table
  public.penalty_attachments,
  public.penalty_records,
  public.penalty_structure_tiers,
  public.penalty_definition_staff_types,
  public.penalty_definitions,
  public.penalty_codes,
  public.staff_import_rows,
  public.staff_import_batches,
  public.staff,
  public.audit_log
restart identity;
