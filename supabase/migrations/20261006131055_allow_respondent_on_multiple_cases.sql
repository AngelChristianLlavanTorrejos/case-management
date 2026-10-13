-- A community User may be linked as respondent on multiple cases.

drop index if exists public.complaints_respondent_user_id_uidx;

create index if not exists complaints_respondent_user_id_idx
  on public.complaints (respondent_user_id)
  where respondent_user_id is not null;

create or replace function public.list_linkable_case_respondents(
  p_complaint_id bigint,
  p_actor_user_id bigint,
  p_search text default ''
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
  v_owner_id bigint;
  v_owner_role text;
  v_respondent_id bigint;
  v_has_settlement boolean;
  v_search text := lower(btrim(coalesce(p_search, '')));
  v_result json;
begin
  perform public.require_activity_actor(p_actor_user_id);

  select r.name
  into v_actor_role
  from public.users u
  join public.roles r on r.id = u.role_id
  where u.id = p_actor_user_id;

  if v_actor_role is null then
    raise exception 'Actor not found';
  end if;

  if v_actor_role = 'User' then
    raise exception 'You cannot link a respondent account for this case.';
  end if;

  select
    c.user_id,
    c.respondent_user_id,
    owner_role.name,
    exists (
      select 1 from public.amicable_settlements s where s.complaint_id = c.id
    )
  into v_owner_id, v_respondent_id, v_owner_role, v_has_settlement
  from public.complaints c
  join public.users owner_u on owner_u.id = c.user_id
  join public.roles owner_role on owner_role.id = owner_u.role_id
  where c.id = p_complaint_id;

  if not found then
    raise exception 'Complaint not found';
  end if;

  if not v_has_settlement then
    raise exception 'Record an amicable settlement first.';
  end if;

  if v_owner_role is distinct from 'User' then
    raise exception 'Respondent accounts are only required for community-filed cases.';
  end if;

  if v_respondent_id is not null then
    raise exception 'This case already has a linked respondent account.';
  end if;

  select coalesce(
    json_agg(
      json_build_object(
        'id', u.id,
        'display_name', public.user_display_name(u.id),
        'username', u.username,
        'mobile_number', coalesce(ci.mobile_number, '')
      )
      order by public.user_display_name(u.id), u.username, u.id
    ),
    '[]'::json
  )
  into v_result
  from public.users u
  join public.roles r on r.id = u.role_id
  join public.status s on s.id = u.status_id
  left join public.contact_information ci on ci.user_id = u.id
  where r.name = 'User'
    and lower(s.name) = 'active'
    and u.id is distinct from v_owner_id
    and (
      v_search = ''
      or lower(public.user_display_name(u.id)) like '%' || v_search || '%'
      or lower(u.username) like '%' || v_search || '%'
      or lower(coalesce(ci.mobile_number, '')) like '%' || v_search || '%'
    );

  return v_result;
end;
$$;

create or replace function public.link_existing_case_respondent(
  p_complaint_id bigint,
  p_actor_user_id bigint,
  p_user_id bigint
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
  v_owner_id bigint;
  v_owner_role text;
  v_respondent_id bigint;
  v_case_no text;
  v_has_settlement boolean;
  v_user_role text;
  v_user_status text;
  v_username text;
  v_actor_name text;
begin
  perform public.require_activity_actor(p_actor_user_id);

  select r.name
  into v_actor_role
  from public.users u
  join public.roles r on r.id = u.role_id
  where u.id = p_actor_user_id;

  if v_actor_role is null then
    raise exception 'Actor not found';
  end if;

  if v_actor_role = 'User' then
    raise exception 'You cannot link a respondent account for this case.';
  end if;

  select
    c.barangay_case_no,
    c.user_id,
    c.respondent_user_id,
    owner_role.name,
    exists (
      select 1 from public.amicable_settlements s where s.complaint_id = c.id
    )
  into v_case_no, v_owner_id, v_respondent_id, v_owner_role, v_has_settlement
  from public.complaints c
  join public.users owner_u on owner_u.id = c.user_id
  join public.roles owner_role on owner_role.id = owner_u.role_id
  where c.id = p_complaint_id;

  if not found then
    raise exception 'Complaint not found';
  end if;

  if not v_has_settlement then
    raise exception 'Record an amicable settlement first.';
  end if;

  if v_owner_role is distinct from 'User' then
    raise exception 'Respondent accounts are only required for community-filed cases.';
  end if;

  if v_respondent_id is not null then
    raise exception 'This case already has a linked respondent account.';
  end if;

  if p_user_id is null then
    raise exception 'Select an existing account.';
  end if;

  if p_user_id = v_owner_id then
    raise exception 'The complainant account cannot be linked as the respondent.';
  end if;

  select u.username, r.name, lower(s.name)
  into v_username, v_user_role, v_user_status
  from public.users u
  join public.roles r on r.id = u.role_id
  join public.status s on s.id = u.status_id
  where u.id = p_user_id;

  if not found then
    raise exception 'Account not found.';
  end if;

  if v_user_role is distinct from 'User' then
    raise exception 'Only community User accounts can be linked as respondents.';
  end if;

  if v_user_status is distinct from 'active' then
    raise exception 'Only active accounts can be linked as respondents.';
  end if;

  update public.complaints
  set respondent_user_id = p_user_id
  where id = p_complaint_id
    and respondent_user_id is null;

  if not found then
    raise exception 'This case already has a linked respondent account.';
  end if;

  v_actor_name := public.user_display_name(p_actor_user_id);

  perform public.write_user_activity_log(
    p_actor_user_id,
    'edit',
    public.menu_id_by_path('/amicable-settlement'),
    format(
      '%s linked an existing respondent account for case %s (%s).',
      v_actor_name,
      coalesce(v_case_no, '—'),
      v_username
    ),
    null,
    jsonb_build_object(
      'complaint_id', p_complaint_id,
      'barangay_case_no', v_case_no,
      'respondent_user_id', p_user_id,
      'username', v_username
    )
  );

  return json_build_object(
    'id', p_user_id,
    'complaint_id', p_complaint_id,
    'username', v_username
  );
end;
$$;

notify pgrst, 'reload schema';
