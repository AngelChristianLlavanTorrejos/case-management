alter table public.amicable_settlements
  drop constraint if exists amicable_settlements_status_check;

alter table public.amicable_settlements
  add constraint amicable_settlements_status_check
    check (status is null or status in (
      'settled',
      'repudiated',
      'motion_for_execution',
      'notice_of_hearing_motion',
      'notice_of_execution'
    ));

update public.amicable_settlements s
set status = 'notice_of_execution'
from public.notices_of_execution e
join public.notices_of_hearing_motion n on n.id = e.notice_motion_id
join public.motions_for_execution m on m.id = n.motion_id
where m.complaint_id = s.complaint_id
  and s.status is distinct from 'settled'
  and s.status is distinct from 'repudiated';

update public.amicable_settlements s
set status = 'notice_of_hearing_motion'
from public.notices_of_hearing_motion n
join public.motions_for_execution m on m.id = n.motion_id
where m.complaint_id = s.complaint_id
  and s.status is distinct from 'settled'
  and s.status is distinct from 'repudiated'
  and s.status is distinct from 'notice_of_execution'
  and not exists (
    select 1
    from public.notices_of_execution e
    where e.notice_motion_id = n.id
  );

create or replace function public.mark_amicable_settlement_settled(
  p_id bigint,
  p_actor_user_id bigint
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case_no text;
  v_status text;
  v_actor_name text;
begin
  perform public.require_activity_actor(p_actor_user_id);

  select c.barangay_case_no, s.status
  into v_case_no, v_status
  from public.amicable_settlements s
  join public.complaints c on c.id = s.complaint_id
  where s.id = p_id;

  if not found then
    raise exception 'Amicable settlement not found';
  end if;

  if v_status in ('settled', 'repudiated') then
    raise exception 'This settlement already has an outcome.';
  end if;

  update public.amicable_settlements
  set status = 'settled',
      is_settled = true
  where id = p_id;

  v_actor_name := public.user_display_name(p_actor_user_id);

  perform public.write_user_activity_log(
    p_actor_user_id,
    'edit',
    public.menu_id_by_path('/amicable-settlement'),
    format('%s marked an amicable settlement as settled (%s).', v_actor_name, v_case_no),
    null,
    jsonb_build_object(
      'settlement_id', p_id,
      'barangay_case_no', v_case_no,
      'status', 'settled'
    )
  );

  return json_build_object('ok', true);
end;
$$;

create or replace function public.issue_notice_of_hearing_motion(
  p_motion_id bigint,
  p_actor_user_id bigint,
  p_appear_at timestamptz,
  p_filed_by text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case_no text;
  v_complaint_id bigint;
  v_filed_by text := lower(btrim(coalesce(p_filed_by, '')));
  v_id bigint;
  v_actor_name text;
begin
  perform public.require_activity_actor(p_actor_user_id);

  if p_appear_at is null then
    raise exception 'Appear on is required.';
  end if;

  if v_filed_by not in ('complainants', 'respondents') then
    raise exception 'Filed by must be complainants or respondents.';
  end if;

  select c.barangay_case_no, m.complaint_id
  into v_case_no, v_complaint_id
  from public.motions_for_execution m
  join public.complaints c on c.id = m.complaint_id
  where m.id = p_motion_id;

  if not found then
    raise exception 'Motion for execution not found';
  end if;

  if exists (
    select 1
    from public.notices_of_hearing_motion n
    where n.motion_id = p_motion_id
  ) then
    raise exception 'A notice of hearing already exists for this motion.';
  end if;

  insert into public.notices_of_hearing_motion (motion_id, appear_at, filed_by)
  values (p_motion_id, p_appear_at, v_filed_by)
  returning id into v_id;

  update public.amicable_settlements
  set status = 'notice_of_hearing_motion'
  where complaint_id = v_complaint_id
    and status is distinct from 'settled'
    and status is distinct from 'repudiated';

  v_actor_name := public.user_display_name(p_actor_user_id);

  perform public.write_user_activity_log(
    p_actor_user_id,
    'add',
    public.menu_id_by_path('/notice-of-hearing-motion'),
    format('%s issued a notice of hearing re motion for execution (%s).', v_actor_name, v_case_no),
    null,
    jsonb_build_object(
      'notice_id', v_id,
      'motion_id', p_motion_id,
      'barangay_case_no', v_case_no,
      'appear_at', p_appear_at,
      'filed_by', v_filed_by
    )
  );

  return json_build_object('id', v_id);
end;
$$;

create or replace function public.create_notice_of_execution(
  p_notice_motion_id bigint,
  p_actor_user_id bigint,
  p_party_obliged text,
  p_personal_property_of text,
  p_amount text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case_no text;
  v_complaint_id bigint;
  v_appear_at timestamptz;
  v_status text;
  v_party text := lower(btrim(coalesce(p_party_obliged, '')));
  v_property text := btrim(coalesce(p_personal_property_of, ''));
  v_amount text := btrim(coalesce(p_amount, ''));
  v_id bigint;
  v_actor_name text;
begin
  perform public.require_activity_actor(p_actor_user_id);

  if v_party not in ('complainants', 'respondents') then
    raise exception 'Party obliged must be complainants or respondents.';
  end if;

  if v_property = '' then
    raise exception 'Personal property of is required.';
  end if;

  if v_amount = '' then
    raise exception 'The sum of is required.';
  end if;

  select c.barangay_case_no, m.complaint_id, n.appear_at, s.status
  into v_case_no, v_complaint_id, v_appear_at, v_status
  from public.notices_of_hearing_motion n
  join public.motions_for_execution m on m.id = n.motion_id
  join public.complaints c on c.id = m.complaint_id
  join public.amicable_settlements s on s.complaint_id = c.id
  where n.id = p_notice_motion_id;

  if not found then
    raise exception 'Notice of hearing (motion) not found';
  end if;

  if v_status = 'settled' then
    raise exception 'This settlement is already settled.';
  end if;

  if v_appear_at >= now() - interval '5 days' then
    raise exception 'The five-day period after the hearing has not expired.';
  end if;

  if exists (
    select 1
    from public.notices_of_execution e
    where e.notice_motion_id = p_notice_motion_id
  ) then
    raise exception 'A notice of execution already exists for this case.';
  end if;

  insert into public.notices_of_execution (
    notice_motion_id,
    party_obliged,
    personal_property_of,
    amount
  )
  values (
    p_notice_motion_id,
    v_party,
    v_property,
    v_amount
  )
  returning id into v_id;

  update public.amicable_settlements
  set status = 'notice_of_execution'
  where complaint_id = v_complaint_id
    and status is distinct from 'settled'
    and status is distinct from 'repudiated';

  v_actor_name := public.user_display_name(p_actor_user_id);

  perform public.write_user_activity_log(
    p_actor_user_id,
    'add',
    public.menu_id_by_path('/notice-of-execution'),
    format('%s recorded a notice of execution (%s).', v_actor_name, v_case_no),
    null,
    jsonb_build_object(
      'execution_id', v_id,
      'notice_motion_id', p_notice_motion_id,
      'barangay_case_no', v_case_no
    )
  );

  return json_build_object('id', v_id);
end;
$$;

notify pgrst, 'reload schema';
