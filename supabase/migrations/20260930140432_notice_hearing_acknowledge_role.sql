-- Super Admin and Admin can read every notice. Only the User who owns it can acknowledge it.

create or replace function public.update_notice_of_hearing(
  p_id bigint,
  p_actor_user_id bigint,
  p_appear_at timestamptz,
  p_acknowledged_on timestamptz default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_case_no text;
  v_actor_name text;
  v_role_name text;
begin
  perform public.require_activity_actor(p_actor_user_id);

  if p_appear_at is null then
    raise exception 'Appear on is required.';
  end if;

  select r.name
  into v_role_name
  from public.users u
  join public.roles r on r.id = u.role_id
  where u.id = p_actor_user_id;

  if v_role_name is null then
    raise exception 'Actor not found';
  end if;

  if v_role_name in ('Super Admin', 'Admin') then
    raise exception 'You cannot acknowledge this notice.';
  end if;

  select public.get_notice_of_hearing(p_id, p_actor_user_id)::jsonb, c.barangay_case_no
  into v_old, v_case_no
  from public.notice_of_hearing n
  join public.complaints c on c.id = n.complaint_id
  where n.id = p_id;

  if not found then
    raise exception 'Notice of hearing not found';
  end if;

  update public.notice_of_hearing
  set
    appear_at = p_appear_at,
    acknowledged_on = p_acknowledged_on
  where id = p_id;

  v_actor_name := public.user_display_name(p_actor_user_id);

  perform public.write_user_activity_log(
    p_actor_user_id,
    'edit',
    public.menu_id_by_path('/notice-of-hearing'),
    format('%s updated a notice of hearing (%s).', v_actor_name, coalesce(v_case_no, '—')),
    v_old,
    public.get_notice_of_hearing(p_id, p_actor_user_id)::jsonb
  );

  return json_build_object('ok', true, 'id', p_id);
end;
$$;

revoke all on function public.update_notice_of_hearing(bigint, bigint, timestamptz, timestamptz) from public;
grant execute on function public.update_notice_of_hearing(bigint, bigint, timestamptz, timestamptz) to anon, authenticated;

notify pgrst, 'reload schema';
