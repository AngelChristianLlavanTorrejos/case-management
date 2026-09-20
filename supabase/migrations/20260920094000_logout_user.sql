create or replace function public.logout_user(p_user_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
begin
  select username into v_username
  from public.users
  where id = p_user_id;

  if v_username is null then
    raise exception 'User not found';
  end if;

  return json_build_object(
    'ok', true,
    'id', p_user_id,
    'username', v_username
  );
end;
$$;

revoke all on function public.logout_user(bigint) from public;
grant execute on function public.logout_user(bigint) to anon, authenticated;
