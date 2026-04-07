-- Atomic replacement of user warehouse access assignments
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
begin
  if p_target_user_id is null then
    raise exception 'target user id is required';
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

revoke all on function public.replace_user_warehouse_access(uuid, uuid[]) from public;
grant execute on function public.replace_user_warehouse_access(uuid, uuid[]) to service_role;
