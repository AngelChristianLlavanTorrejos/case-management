-- Activity logs only allow add|edit|delete|approve|restrict|login_failed.
-- mark_repudiation_received_and_filed used invalid 'update'.

create or replace function public.mark_repudiation_received_and_filed(
  p_id bigint,
  p_actor_user_id bigint
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role_name text;
  v_actor_name text;
  v_case_no text;
  v_received_on date;
  v_received_by bigint;
begin
  perform public.require_activity_actor(p_actor_user_id);

  select r.name
  into v_role_name
  from public.users u
  join public.roles r on r.id = u.role_id
  where u.id = p_actor_user_id;

  if v_role_name is null then
    raise exception 'Actor not found';
  end if;

  if v_role_name = 'User' then
    raise exception 'You cannot mark this repudiation as received and filed.';
  end if;

  select rep.received_and_filed_on, rep.received_and_filed_by, c.barangay_case_no
  into v_received_on, v_received_by, v_case_no
  from public.repudiations rep
  join public.complaints c on c.id = rep.complaint_id
  where rep.id = p_id;

  if not found then
    raise exception 'Repudiation not found';
  end if;

  if v_received_on is not null then
    raise exception 'This repudiation is already received and filed.';
  end if;

  update public.repudiations
  set
    received_and_filed_on = current_date,
    received_and_filed_by = p_actor_user_id
  where id = p_id;

  v_actor_name := public.user_display_name(p_actor_user_id);

  perform public.write_user_activity_log(
    p_actor_user_id,
    'edit',
    public.menu_id_by_path('/repudiation'),
    format('%s marked repudiation as received and filed (%s).', v_actor_name, coalesce(v_case_no, '—')),
    jsonb_build_object(
      'repudiation_id', p_id,
      'received_and_filed_on', null,
      'received_and_filed_by', null
    ),
    jsonb_build_object(
      'repudiation_id', p_id,
      'barangay_case_no', v_case_no,
      'received_and_filed_on', current_date,
      'received_and_filed_by', p_actor_user_id
    )
  );

  return json_build_object('id', p_id, 'received_and_filed_on', current_date);
end;
$$;

notify pgrst, 'reload schema';
