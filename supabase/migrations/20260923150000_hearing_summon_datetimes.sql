alter table public.notice_of_hearing
  alter column issued_on type timestamptz using issued_on::timestamp,
  alter column issued_on set default now(),
  alter column acknowledged_on type timestamptz using acknowledged_on::timestamp;

alter table public.summons
  alter column issued_on type timestamptz using issued_on::timestamp,
  alter column issued_on set default now(),
  alter column served_on type timestamptz using served_on::timestamp;

create or replace function public.issue_notice_and_summon(
  p_complaint_id bigint,
  p_actor_user_id bigint,
  p_appear_at timestamptz,
  p_officer_in_charge text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_filed boolean;
  v_issued boolean;
  v_case_no text;
  v_officer text;
  v_issued_at timestamptz;
  v_notice_id bigint;
  v_summon_id bigint;
  v_actor_name text;
begin
  perform public.require_activity_actor(p_actor_user_id);

  if p_appear_at is null then
    raise exception 'Appear on is required.';
  end if;

  select c.is_received_and_filed, c.is_notice_and_summon_issued, c.barangay_case_no
  into v_filed, v_issued, v_case_no
  from public.complaints c
  where c.id = p_complaint_id;

  if not found then
    raise exception 'Complaint not found';
  end if;

  if not v_filed or v_case_no is null then
    raise exception 'This complaint must be received and filed first.';
  end if;

  if v_issued then
    raise exception 'Notice of hearing and summon were already issued.';
  end if;

  v_officer := nullif(btrim(coalesce(p_officer_in_charge, '')), '');
  v_issued_at := now();

  insert into public.notice_of_hearing (complaint_id, appear_at, issued_on)
  values (p_complaint_id, p_appear_at, v_issued_at)
  returning id into v_notice_id;

  insert into public.summons (complaint_id, appear_at, issued_on, officer_in_charge)
  values (p_complaint_id, p_appear_at, v_issued_at, v_officer)
  returning id into v_summon_id;

  update public.complaints
  set is_notice_and_summon_issued = true
  where id = p_complaint_id;

  v_actor_name := public.user_display_name(p_actor_user_id);

  perform public.write_user_activity_log(
    p_actor_user_id,
    'add',
    public.menu_id_by_path('/complainants-form'),
    format('%s issued a notice of hearing and summon (%s).', v_actor_name, v_case_no),
    null,
    jsonb_build_object(
      'complaint_id', p_complaint_id,
      'barangay_case_no', v_case_no,
      'notice_id', v_notice_id,
      'summon_id', v_summon_id,
      'appear_at', p_appear_at,
      'issued_on', v_issued_at,
      'officer_in_charge', v_officer
    )
  );

  return json_build_object('ok', true, 'notice_id', v_notice_id, 'summon_id', v_summon_id);
end;
$$;

drop function if exists public.update_notice_of_hearing(bigint, bigint, timestamptz, date);

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
begin
  perform public.require_activity_actor(p_actor_user_id);

  if p_appear_at is null then
    raise exception 'Appear on is required.';
  end if;

  select public.get_notice_of_hearing(p_id)::jsonb, c.barangay_case_no
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
    public.get_notice_of_hearing(p_id)::jsonb
  );

  return json_build_object('ok', true, 'id', p_id);
end;
$$;

drop function if exists public.update_summon(bigint, bigint, timestamptz, date, text, text, text);

create or replace function public.update_summon(
  p_id bigint,
  p_actor_user_id bigint,
  p_appear_at timestamptz,
  p_served_on timestamptz default null,
  p_dwelling_recipient text default null,
  p_office_recipient text default null,
  p_officer_in_charge text default null
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
begin
  perform public.require_activity_actor(p_actor_user_id);

  if p_appear_at is null then
    raise exception 'Appear on is required.';
  end if;

  select public.get_summon(p_id)::jsonb, c.barangay_case_no
  into v_old, v_case_no
  from public.summons s
  join public.complaints c on c.id = s.complaint_id
  where s.id = p_id;

  if not found then
    raise exception 'Summon not found';
  end if;

  update public.summons
  set
    appear_at = p_appear_at,
    served_on = p_served_on,
    dwelling_recipient = nullif(btrim(coalesce(p_dwelling_recipient, '')), ''),
    office_recipient = nullif(btrim(coalesce(p_office_recipient, '')), ''),
    officer_in_charge = nullif(btrim(coalesce(p_officer_in_charge, '')), '')
  where id = p_id;

  v_actor_name := public.user_display_name(p_actor_user_id);

  perform public.write_user_activity_log(
    p_actor_user_id,
    'edit',
    public.menu_id_by_path('/summon-for-the-respondent'),
    format('%s updated a summon (%s).', v_actor_name, coalesce(v_case_no, '—')),
    v_old,
    public.get_summon(p_id)::jsonb
  );

  return json_build_object('ok', true, 'id', p_id);
end;
$$;

revoke all on function public.issue_notice_and_summon(bigint, bigint, timestamptz, text) from public;
grant execute on function public.issue_notice_and_summon(bigint, bigint, timestamptz, text) to anon, authenticated;

revoke all on function public.update_notice_of_hearing(bigint, bigint, timestamptz, timestamptz) from public;
grant execute on function public.update_notice_of_hearing(bigint, bigint, timestamptz, timestamptz) to anon, authenticated;

revoke all on function public.update_summon(bigint, bigint, timestamptz, timestamptz, text, text, text) from public;
grant execute on function public.update_summon(bigint, bigint, timestamptz, timestamptz, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
