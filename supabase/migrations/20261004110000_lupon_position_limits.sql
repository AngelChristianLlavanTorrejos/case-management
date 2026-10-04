-- One chairman, one secretary, and at most 20 Lupon Member seats.

create or replace function public.assert_lupon_position_available(
  p_position_id bigint,
  p_exclude_user_id bigint default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_position_name text;
  v_count integer;
begin
  select name
  into v_position_name
  from public.positions
  where id = p_position_id;

  if v_position_name is null then
    raise exception 'Position is required.';
  end if;

  select count(*)::integer
  into v_count
  from public.users u
  where u.position_id = p_position_id
    and (p_exclude_user_id is null or u.id is distinct from p_exclude_user_id);

  if v_position_name = 'Lupon Chairman/Barangay Chairman' and v_count >= 1 then
    raise exception 'A Lupon Chairman/Barangay Chairman already exists.';
  end if;

  if v_position_name = 'Lupon Secretary/Barangay Secretary' and v_count >= 1 then
    raise exception 'A Lupon Secretary/Barangay Secretary already exists.';
  end if;

  if v_position_name = 'Lupon Member' and v_count >= 20 then
    raise exception 'The maximum of 20 Lupon Members has been reached.';
  end if;
end;
$$;

revoke all on function public.assert_lupon_position_available(bigint, bigint) from public;

create or replace function public.enforce_lupon_position_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.position_id is null then
    return new;
  end if;

  perform public.assert_lupon_position_available(new.position_id, new.id);
  return new;
end;
$$;

revoke all on function public.enforce_lupon_position_limits() from public;

drop trigger if exists users_lupon_position_limits on public.users;

create trigger users_lupon_position_limits
before insert or update of position_id on public.users
for each row
when (new.position_id is not null)
execute function public.enforce_lupon_position_limits();

create or replace function public.list_available_lupon_positions(
  p_exclude_user_id bigint default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  select coalesce(
    json_agg(
      json_build_object(
        'id', p.id,
        'name', p.name,
        'sort_order', p.sort_order
      )
      order by p.sort_order, p.id
    ),
    '[]'::json
  )
  into v_result
  from public.positions p
  where (
    p.name = 'Lupon Chairman/Barangay Chairman'
    and not exists (
      select 1
      from public.users u
      where u.position_id = p.id
        and (p_exclude_user_id is null or u.id is distinct from p_exclude_user_id)
    )
  )
  or (
    p.name = 'Lupon Secretary/Barangay Secretary'
    and not exists (
      select 1
      from public.users u
      where u.position_id = p.id
        and (p_exclude_user_id is null or u.id is distinct from p_exclude_user_id)
    )
  )
  or (
    p.name = 'Lupon Member'
    and (
      select count(*)::integer
      from public.users u
      where u.position_id = p.id
        and (p_exclude_user_id is null or u.id is distinct from p_exclude_user_id)
    ) < 20
  );

  return v_result;
end;
$$;

revoke all on function public.list_available_lupon_positions(bigint) from public;
grant execute on function public.list_available_lupon_positions(bigint) to anon, authenticated;

notify pgrst, 'reload schema';
