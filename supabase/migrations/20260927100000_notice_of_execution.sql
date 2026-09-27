insert into public.menus (parent_id, name, icon, path, sort_order, is_active)
select null, 'Notice of Execution', 'Stamp', '/notice-of-execution', 11, true
where not exists (
  select 1 from public.menus where path = '/notice-of-execution'
);

update public.menus
set sort_order = 12
where name = 'Masterfile' and parent_id is null;

update public.menus
set sort_order = 13
where name = 'User Activity Log' and parent_id is null;

update public.menus
set sort_order = 14
where name = 'Baseline Security' and parent_id is null;

update public.menus
set sort_order = 15
where name = 'My Profile' and parent_id is null;

update public.menus
set sort_order = 16
where name = 'Change Password' and parent_id is null;

create table public.notices_of_execution (
  id bigint generated always as identity primary key,
  notice_motion_id bigint not null unique references public.notices_of_hearing_motion (id) on delete cascade,
  party_obliged text not null,
  personal_property_of text not null,
  amount text not null,
  created_at timestamptz not null default now(),
  constraint notices_of_execution_party_obliged_check
    check (party_obliged in ('complainants', 'respondents')),
  constraint notices_of_execution_property_not_blank
    check (char_length(btrim(personal_property_of)) > 0),
  constraint notices_of_execution_amount_not_blank
    check (char_length(btrim(amount)) > 0)
);

create index notices_of_execution_created_at_idx
  on public.notices_of_execution (created_at desc);

alter table public.notices_of_execution enable row level security;
revoke all on table public.notices_of_execution from public, anon, authenticated;

create or replace function public.list_notices_of_hearing_motion(
  p_search text default '',
  p_sort_key text default 'issued_on',
  p_sort_dir text default 'desc',
  p_page integer default 1,
  p_page_size integer default 10
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_search text := lower(btrim(coalesce(p_search, '')));
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 10), 1), 100);
  v_offset integer;
  v_result json;
begin
  v_offset := (v_page - 1) * v_page_size;

  with base as (
    select
      n.id,
      n.motion_id,
      m.complaint_id,
      c.barangay_case_no,
      coalesce(
        (
          select string_agg(p.name, ', ' order by p.sort_order)
          from public.complaint_parties p
          where p.complaint_id = c.id and p.party_type = 'complainant'
        ),
        ''
      ) as complainants,
      coalesce(
        (
          select string_agg(p.name, ', ' order by p.sort_order)
          from public.complaint_parties p
          where p.complaint_id = c.id and p.party_type = 'respondent'
        ),
        ''
      ) as respondents,
      n.appear_at,
      n.filed_by,
      n.issued_on,
      s.status
    from public.notices_of_hearing_motion n
    join public.motions_for_execution m on m.id = n.motion_id
    join public.complaints c on c.id = m.complaint_id
    join public.amicable_settlements s on s.complaint_id = c.id
  ),
  filtered as (
    select *
    from base
    where v_search = ''
       or lower(coalesce(barangay_case_no, '')) like '%' || v_search || '%'
       or lower(complainants) like '%' || v_search || '%'
       or lower(respondents) like '%' || v_search || '%'
       or lower(filed_by) like '%' || v_search || '%'
  ),
  counted as (
    select count(*)::integer as total from filtered
  ),
  paged as (
    select *
    from filtered
    order by
      case when p_sort_key = 'barangay_case_no' and p_sort_dir = 'asc' then barangay_case_no end asc,
      case when p_sort_key = 'barangay_case_no' and p_sort_dir = 'desc' then barangay_case_no end desc,
      case when p_sort_key = 'complainants' and p_sort_dir = 'asc' then complainants end asc,
      case when p_sort_key = 'complainants' and p_sort_dir = 'desc' then complainants end desc,
      case when p_sort_key = 'respondents' and p_sort_dir = 'asc' then respondents end asc,
      case when p_sort_key = 'respondents' and p_sort_dir = 'desc' then respondents end desc,
      case when p_sort_key = 'appear_at' and p_sort_dir = 'asc' then appear_at end asc,
      case when p_sort_key = 'appear_at' and p_sort_dir = 'desc' then appear_at end desc,
      case when p_sort_key = 'filed_by' and p_sort_dir = 'asc' then filed_by end asc,
      case when p_sort_key = 'filed_by' and p_sort_dir = 'desc' then filed_by end desc,
      case when p_sort_key = 'issued_on' and p_sort_dir = 'asc' then issued_on end asc,
      case when p_sort_key = 'issued_on' and p_sort_dir = 'desc' then issued_on end desc,
      issued_on desc,
      id desc
    offset v_offset
    limit v_page_size
  )
  select json_build_object(
    'rows', coalesce((select json_agg(row_to_json(paged)) from paged), '[]'::json),
    'total', (select total from counted)
  )
  into v_result;

  return v_result;
end;
$$;

create or replace function public.mark_notice_of_hearing_motion_settled(
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
  v_settlement_id bigint;
  v_status text;
  v_actor_name text;
begin
  perform public.require_activity_actor(p_actor_user_id);

  select c.barangay_case_no, s.id, s.status
  into v_case_no, v_settlement_id, v_status
  from public.notices_of_hearing_motion n
  join public.motions_for_execution m on m.id = n.motion_id
  join public.complaints c on c.id = m.complaint_id
  join public.amicable_settlements s on s.complaint_id = c.id
  where n.id = p_id;

  if not found then
    raise exception 'Notice of hearing (motion) not found';
  end if;

  if v_status = 'settled' then
    raise exception 'This settlement is already settled.';
  end if;

  update public.amicable_settlements
  set status = 'settled',
      is_settled = true
  where id = v_settlement_id;

  v_actor_name := public.user_display_name(p_actor_user_id);

  perform public.write_user_activity_log(
    p_actor_user_id,
    'edit',
    public.menu_id_by_path('/amicable-settlement'),
    format('%s marked an amicable settlement as settled (%s).', v_actor_name, v_case_no),
    null,
    jsonb_build_object(
      'settlement_id', v_settlement_id,
      'notice_motion_id', p_id,
      'barangay_case_no', v_case_no,
      'status', 'settled'
    )
  );

  return json_build_object('ok', true);
end;
$$;

create or replace function public.list_notice_of_execution_cases()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  select coalesce(
    json_agg(row_to_json(cases) order by cases.barangay_case_no),
    '[]'::json
  )
  into v_result
  from (
    select
      n.id,
      c.barangay_case_no,
      coalesce(
        (
          select string_agg(p.name, ', ' order by p.sort_order)
          from public.complaint_parties p
          where p.complaint_id = c.id and p.party_type = 'complainant'
        ),
        ''
      ) as complainants,
      coalesce(
        (
          select string_agg(p.name, ', ' order by p.sort_order)
          from public.complaint_parties p
          where p.complaint_id = c.id and p.party_type = 'respondent'
        ),
        ''
      ) as respondents,
      s.terms
    from public.notices_of_hearing_motion n
    join public.motions_for_execution m on m.id = n.motion_id
    join public.complaints c on c.id = m.complaint_id
    join public.amicable_settlements s on s.complaint_id = c.id
    where n.appear_at < now() - interval '5 days'
      and s.status is distinct from 'settled'
      and not exists (
        select 1
        from public.notices_of_execution e
        where e.notice_motion_id = n.id
      )
  ) as cases;

  return v_result;
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

  select c.barangay_case_no, n.appear_at, s.status
  into v_case_no, v_appear_at, v_status
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

create or replace function public.list_notices_of_execution(
  p_search text default '',
  p_sort_key text default 'created_at',
  p_sort_dir text default 'desc',
  p_page integer default 1,
  p_page_size integer default 10
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_search text := lower(btrim(coalesce(p_search, '')));
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 10), 1), 100);
  v_offset integer;
  v_result json;
begin
  v_offset := (v_page - 1) * v_page_size;

  with base as (
    select
      e.id,
      e.notice_motion_id,
      m.complaint_id,
      c.barangay_case_no,
      coalesce(
        (
          select string_agg(p.name, ', ' order by p.sort_order)
          from public.complaint_parties p
          where p.complaint_id = c.id and p.party_type = 'complainant'
        ),
        ''
      ) as complainants,
      coalesce(
        (
          select string_agg(p.name, ', ' order by p.sort_order)
          from public.complaint_parties p
          where p.complaint_id = c.id and p.party_type = 'respondent'
        ),
        ''
      ) as respondents,
      e.party_obliged,
      e.amount,
      e.created_at
    from public.notices_of_execution e
    join public.notices_of_hearing_motion n on n.id = e.notice_motion_id
    join public.motions_for_execution m on m.id = n.motion_id
    join public.complaints c on c.id = m.complaint_id
  ),
  filtered as (
    select *
    from base
    where v_search = ''
       or lower(coalesce(barangay_case_no, '')) like '%' || v_search || '%'
       or lower(complainants) like '%' || v_search || '%'
       or lower(respondents) like '%' || v_search || '%'
       or lower(party_obliged) like '%' || v_search || '%'
       or lower(amount) like '%' || v_search || '%'
  ),
  counted as (
    select count(*)::integer as total from filtered
  ),
  paged as (
    select *
    from filtered
    order by
      case when p_sort_key = 'barangay_case_no' and p_sort_dir = 'asc' then barangay_case_no end asc,
      case when p_sort_key = 'barangay_case_no' and p_sort_dir = 'desc' then barangay_case_no end desc,
      case when p_sort_key = 'complainants' and p_sort_dir = 'asc' then complainants end asc,
      case when p_sort_key = 'complainants' and p_sort_dir = 'desc' then complainants end desc,
      case when p_sort_key = 'respondents' and p_sort_dir = 'asc' then respondents end asc,
      case when p_sort_key = 'respondents' and p_sort_dir = 'desc' then respondents end desc,
      case when p_sort_key = 'party_obliged' and p_sort_dir = 'asc' then party_obliged end asc,
      case when p_sort_key = 'party_obliged' and p_sort_dir = 'desc' then party_obliged end desc,
      case when p_sort_key = 'amount' and p_sort_dir = 'asc' then amount end asc,
      case when p_sort_key = 'amount' and p_sort_dir = 'desc' then amount end desc,
      case when p_sort_key = 'created_at' and p_sort_dir = 'asc' then created_at end asc,
      case when p_sort_key = 'created_at' and p_sort_dir = 'desc' then created_at end desc,
      created_at desc,
      id desc
    offset v_offset
    limit v_page_size
  )
  select json_build_object(
    'rows', coalesce((select json_agg(row_to_json(paged)) from paged), '[]'::json),
    'total', (select total from counted)
  )
  into v_result;

  return v_result;
end;
$$;

create or replace function public.get_notice_of_execution(p_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  select json_build_object(
    'id', e.id,
    'notice_motion_id', e.notice_motion_id,
    'complaint_id', m.complaint_id,
    'barangay_case_no', c.barangay_case_no,
    'complaint_type', coalesce(ct.name, ''),
    'complainants', coalesce(
      (
        select json_agg(p.name order by p.sort_order)
        from public.complaint_parties p
        where p.complaint_id = c.id and p.party_type = 'complainant'
      ),
      '[]'::json
    ),
    'respondents', coalesce(
      (
        select json_agg(p.name order by p.sort_order)
        from public.complaint_parties p
        where p.complaint_id = c.id and p.party_type = 'respondent'
      ),
      '[]'::json
    ),
    'settlement_created_at', s.created_at,
    'terms', s.terms,
    'party_obliged', e.party_obliged,
    'personal_property_of', e.personal_property_of,
    'amount', e.amount,
    'created_at', e.created_at
  )
  into v_result
  from public.notices_of_execution e
  join public.notices_of_hearing_motion n on n.id = e.notice_motion_id
  join public.motions_for_execution m on m.id = n.motion_id
  join public.complaints c on c.id = m.complaint_id
  join public.amicable_settlements s on s.complaint_id = c.id
  left join public.complaint_types ct on ct.id = c.complaint_type_id
  where e.id = p_id;

  if v_result is null then
    raise exception 'Notice of execution not found';
  end if;

  return v_result;
end;
$$;

revoke all on function public.mark_notice_of_hearing_motion_settled(bigint, bigint) from public;
grant execute on function public.mark_notice_of_hearing_motion_settled(bigint, bigint) to anon, authenticated;

revoke all on function public.list_notice_of_execution_cases() from public;
grant execute on function public.list_notice_of_execution_cases() to anon, authenticated;

revoke all on function public.create_notice_of_execution(bigint, bigint, text, text, text) from public;
grant execute on function public.create_notice_of_execution(bigint, bigint, text, text, text) to anon, authenticated;

revoke all on function public.list_notices_of_execution(text, text, text, integer, integer) from public;
grant execute on function public.list_notices_of_execution(text, text, text, integer, integer) to anon, authenticated;

revoke all on function public.get_notice_of_execution(bigint) from public;
grant execute on function public.get_notice_of_execution(bigint) to anon, authenticated;

notify pgrst, 'reload schema';
