-- Remove optional label from penalty_codes (codes are identified by code only).
alter table public.penalty_codes drop column if exists label;
