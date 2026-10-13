-- Super Admin: set a temporary password for community or lupon member accounts.

create or replace function public.require_super_admin_actor(p_actor_user_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role_name text;
begin
  perform public.require_activity_actor(p_actor_user_id);

  select r.name
  into v_role_name
  from public.users u
  join public.roles r on r.id = u.role_id
  where u.id = p_actor_user_id;

  if v_role_name is distinct from 'Super Admin' then
    raise exception 'You cannot perform this action.';
  end if;
end;
$$;

create or replace function public.super_admin_set_user_password(
  p_actor_user_id bigint,
  p_target_user_id bigint,
  p_new_password text,
  p_member_scope text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.users%rowtype;
  v_scope text := lower(btrim(coalesce(p_member_scope, '')));
  v_menu_path text;
  v_actor_name text;
  v_target_name text;
begin
  perform public.require_super_admin_actor(p_actor_user_id);

  if p_target_user_id is null then
    raise exception 'Account not found.';
  end if;

  select * into v_target from public.users where id = p_target_user_id;
  if not found then
    raise exception 'Account not found.';
  end if;

  if v_scope = 'community' then
    v_menu_path := '/community-members';
    if not exists (
      select 1
      from public.users u
      join public.roles r on r.id = u.role_id
      where u.id = p_target_user_id
        and r.name = 'User'
    ) then
      raise exception 'Community member not found.';
    end if;
  elsif v_scope = 'lupon' then
    v_menu_path := '/lupon-members';
    if not exists (
      select 1
      from public.users u
      where u.id = p_target_user_id
        and u.position_id is not null
    ) then
      raise exception 'Lupon member not found.';
    end if;
  else
    raise exception 'Invalid member scope.';
  end if;

  perform public.assert_password_policy(p_new_password, v_target.username);

  update public.users
  set
    password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
    should_change_password = true,
    failed_login_attempts = 0
  where id = p_target_user_id;

  v_actor_name := public.user_display_name(p_actor_user_id);
  v_target_name := public.user_display_name(p_target_user_id);

  perform public.write_user_activity_log(
    p_actor_user_id,
    'edit',
    public.menu_id_by_path(v_menu_path),
    format('%s reset the password for %s.', v_actor_name, v_target_name),
    jsonb_build_object('user_id', p_target_user_id, 'should_change_password', v_target.should_change_password),
    jsonb_build_object('user_id', p_target_user_id, 'should_change_password', true)
  );

  return json_build_object('ok', true, 'id', p_target_user_id);
end;
$$;

revoke all on function public.require_super_admin_actor(bigint) from public;
revoke all on function public.super_admin_set_user_password(bigint, bigint, text, text) from public;

grant execute on function public.require_super_admin_actor(bigint) to anon, authenticated;
grant execute on function public.super_admin_set_user_password(bigint, bigint, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
