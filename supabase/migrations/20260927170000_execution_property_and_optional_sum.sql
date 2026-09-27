alter table public.notices_of_execution
  drop constraint if exists notices_of_execution_amount_not_blank;

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
  v_property text;
  v_amount text := btrim(coalesce(p_amount, ''));
  -- p_personal_property_of stays in the signature. The saved names always follow the obliged party.
  v_id bigint;
  v_actor_name text;
begin
  perform public.require_activity_actor(p_actor_user_id);

  if v_party not in ('complainants', 'respondents') then
    raise exception 'Party obliged must be complainants or respondents.';
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

  select string_agg(p.name, ', ' order by p.sort_order)
  into v_property
  from public.complaint_parties p
  where p.complaint_id = v_complaint_id
    and p.party_type = case
      when v_party = 'respondents' then 'respondent'
      else 'complainant'
    end;

  v_property := btrim(coalesce(v_property, ''));

  if v_property = '' then
    raise exception 'The obliged party has no names on this case.';
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
