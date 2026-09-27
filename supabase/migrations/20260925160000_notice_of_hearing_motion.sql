insert into public.menus (parent_id, name, icon, path, sort_order, is_active)
select null, 'Notice of Hearing (RE: Motion for Execution)', 'Megaphone', '/notice-of-hearing-motion', 10, true
where not exists (
  select 1 from public.menus where path = '/notice-of-hearing-motion'
);

update public.menus
set sort_order = 11
where name = 'Masterfile' and parent_id is null;

update public.menus
set sort_order = 12
where name = 'User Activity Log' and parent_id is null;

update public.menus
set sort_order = 13
where name = 'Baseline Security' and parent_id is null;

update public.menus
set sort_order = 14
where name = 'My Profile' and parent_id is null;

update public.menus
set sort_order = 15
where name = 'Change Password' and parent_id is null;

create table public.notices_of_hearing_motion (
  id bigint generated always as identity primary key,
  motion_id bigint not null unique references public.motions_for_execution (id) on delete cascade,
  appear_at timestamptz not null,
  filed_by text not null,
  issued_on timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint notices_of_hearing_motion_filed_by_check
    check (filed_by in ('complainants', 'respondents'))
);

create index notices_of_hearing_motion_issued_on_idx
  on public.notices_of_hearing_motion (issued_on desc);

alter table public.notices_of_hearing_motion enable row level security;
revoke all on table public.notices_of_hearing_motion from public, anon, authenticated;

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

  select c.barangay_case_no
  into v_case_no
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
      n.issued_on
    from public.notices_of_hearing_motion n
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

create or replace function public.get_notice_of_hearing_motion(p_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  select json_build_object(
    'id', n.id,
    'motion_id', n.motion_id,
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
    'appear_at', n.appear_at,
    'filed_by', n.filed_by,
    'issued_on', n.issued_on,
    'created_at', n.created_at
  )
  into v_result
  from public.notices_of_hearing_motion n
  join public.motions_for_execution m on m.id = n.motion_id
  join public.complaints c on c.id = m.complaint_id
  left join public.complaint_types ct on ct.id = c.complaint_type_id
  where n.id = p_id;

  if v_result is null then
    raise exception 'Notice of hearing (motion) not found';
  end if;

  return v_result;
end;
$$;

create or replace function public.list_motions_for_execution(
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
      m.id,
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
      m.created_at,
      exists (
        select 1
        from public.notices_of_hearing_motion n
        where n.motion_id = m.id
      ) as has_notice
    from public.motions_for_execution m
    join public.complaints c on c.id = m.complaint_id
  ),
  filtered as (
    select *
    from base
    where v_search = ''
       or lower(coalesce(barangay_case_no, '')) like '%' || v_search || '%'
       or lower(complainants) like '%' || v_search || '%'
       or lower(respondents) like '%' || v_search || '%'
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

revoke all on function public.issue_notice_of_hearing_motion(bigint, bigint, timestamptz, text) from public;
grant execute on function public.issue_notice_of_hearing_motion(bigint, bigint, timestamptz, text) to anon, authenticated;

revoke all on function public.list_notices_of_hearing_motion(text, text, text, integer, integer) from public;
grant execute on function public.list_notices_of_hearing_motion(text, text, text, integer, integer) to anon, authenticated;

revoke all on function public.get_notice_of_hearing_motion(bigint) from public;
grant execute on function public.get_notice_of_hearing_motion(bigint) to anon, authenticated;

notify pgrst, 'reload schema';
