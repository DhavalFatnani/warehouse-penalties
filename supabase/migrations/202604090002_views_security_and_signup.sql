-- Make reporting views respect caller permissions.
-- In Supabase, this removes "UNRESTRICTED" behavior by evaluating underlying
-- table access as the invoker (RLS-aware).
alter view public.v_penalty_records_with_staff set (security_invoker = true);
alter view public.v_staff_penalty_summary set (security_invoker = true);

-- Auto-provision public.users row when a new auth user signs up.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
  v_default_warehouse_id uuid;
  v_app_user_id uuid;
begin
  v_full_name := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    split_part(new.email, '@', 1),
    'Manager'
  );

  insert into public.users (auth_user_id, email, full_name, role, is_active)
  values (new.id, new.email, v_full_name, 'manager', true)
  on conflict (auth_user_id) do update set
    email = excluded.email,
    full_name = coalesce(public.users.full_name, excluded.full_name),
    is_active = true,
    updated_at = now()
  returning id into v_app_user_id;

  -- Give new manager access to DEFAULT warehouse if present.
  select id into v_default_warehouse_id
  from public.warehouses
  where code = 'DEFAULT'
  limit 1;

  if v_default_warehouse_id is not null and v_app_user_id is not null then
    insert into public.user_warehouse_access (user_id, warehouse_id)
    values (v_app_user_id, v_default_warehouse_id)
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();
