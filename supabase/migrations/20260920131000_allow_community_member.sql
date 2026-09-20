alter table public.user_activity_logs
  drop constraint user_activity_logs_activity_check;

alter table public.user_activity_logs
  add constraint user_activity_logs_activity_check
    check (activity in ('add', 'edit', 'delete', 'approve', 'restrict', 'allow', 'login_failed'));

create or replace function public.write_user_activity_log(
  p_user_id bigint,
  p_activity text,
  p_menu_id bigint,
  p_details text,
  p_old_value jsonb default null,
  p_new_value jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_activity not in ('add', 'edit', 'delete', 'approve', 'restrict', 'allow', 'login_failed') then
    raise exception 'Invalid activity';
  end if;

  if p_details is null or char_length(btrim(p_details)) = 0 then
    raise exception 'Details are required';
  end if;

  if p_user_id is not null and not exists (select 1 from public.users where id = p_user_id) then
    raise exception 'Actor not found';
  end if;

  insert into public.user_activity_logs (
    user_id,
    old_value,
    new_value,
    activity,
    menu_id,
    details
  )
  values (
    p_user_id,
    p_old_value,
    p_new_value,
    p_activity,
    p_menu_id,
    btrim(p_details)
  );
end;
$$;

create or replace function public.allow_community_member(p_id bigint, p_actor_user_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status_id bigint;
  v_old jsonb;
  v_new jsonb;
  v_actor_name text;
  v_member_name text;
begin
  perform public.require_activity_actor(p_actor_user_id);

  if not exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    join public.status s on s.id = u.status_id
    where u.id = p_id
      and r.name = 'User'
      and lower(s.name) = 'inactive'
  ) then
    raise exception 'Inactive resident not found';
  end if;

  select id into v_status_id from public.status where lower(name) = 'active';
  if v_status_id is null then
    raise exception 'Active status is not configured';
  end if;

  v_old := public.get_community_member(p_id)::jsonb;
  v_member_name := public.user_display_name(p_id);
  v_actor_name := public.user_display_name(p_actor_user_id);

  update public.users
  set status_id = v_status_id
  where id = p_id;

  v_new := public.get_community_member(p_id)::jsonb;

  perform public.write_user_activity_log(
    p_actor_user_id,
    'allow',
    public.menu_id_by_path('/community-members'),
    format('%s allowed %s.', v_actor_name, v_member_name),
    v_old,
    v_new
  );

  return json_build_object('ok', true, 'id', p_id);
end;
$$;

revoke all on function public.allow_community_member(bigint, bigint) from public;
grant execute on function public.allow_community_member(bigint, bigint) to anon, authenticated;

notify pgrst, 'reload schema';
