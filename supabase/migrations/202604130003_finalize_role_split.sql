-- Finalize manager role split after enum values exist.

-- Preserve existing permissions by migrating legacy managers to central team.
update public.users
set role = 'central_team_member'
where role = 'manager';

alter table public.users
  alter column role set default 'central_team_member';

create or replace function public.is_manager_or_admin()
returns boolean
language sql
stable
as $$
  select coalesce(
    public.current_app_role() in (
      'manager',
      'store_manager',
      'central_team_member',
      'admin'
    ),
    false
  )
$$;

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
    'Central Team Member'
  );

  insert into public.users (auth_user_id, email, full_name, role, is_active)
  values (new.id, new.email, v_full_name, 'central_team_member', true)
  on conflict (auth_user_id) do update set
    email = excluded.email,
    full_name = coalesce(public.users.full_name, excluded.full_name),
    is_active = true,
    updated_at = now()
  returning id into v_app_user_id;

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

create or replace function public.replace_user_warehouse_access(
  p_target_user_id uuid,
  p_warehouse_ids uuid[]
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
  v_target_role public.user_role;
begin
  if p_target_user_id is null then
    raise exception 'target user id is required';
  end if;

  select role into v_target_role
  from public.users
  where id = p_target_user_id;

  if v_target_role is null then
    raise exception 'target user not found';
  end if;

  if
    v_target_role = 'store_manager'
    and coalesce(array_length(p_warehouse_ids, 1), 0) > 1
  then
    raise exception 'store managers can only have one warehouse assignment';
  end if;

  delete from public.user_warehouse_access
  where user_id = p_target_user_id;

  if p_warehouse_ids is not null and array_length(p_warehouse_ids, 1) is not null then
    insert into public.user_warehouse_access (user_id, warehouse_id)
    select p_target_user_id, unnest(p_warehouse_ids)
    on conflict do nothing;
  end if;

  select count(*) into v_count
  from public.user_warehouse_access
  where user_id = p_target_user_id;

  return v_count;
end;
$$;
