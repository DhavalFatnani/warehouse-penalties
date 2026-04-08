-- Soft-retire penalty codes: hidden from new definitions; historic rows unchanged.

alter table public.penalty_codes
  add column if not exists is_active boolean not null default true;
