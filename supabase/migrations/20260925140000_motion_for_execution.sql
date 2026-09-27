insert into public.menus (parent_id, name, icon, path, sort_order, is_active)
select null, 'Motion for Execution', 'Gavel', '/motion-for-execution', 9, true
where not exists (
  select 1 from public.menus where path = '/motion-for-execution'
);

update public.menus
set sort_order = 10
where name = 'Masterfile' and parent_id is null;

update public.menus
set sort_order = 11
where name = 'User Activity Log' and parent_id is null;

update public.menus
set sort_order = 12
where name = 'Baseline Security' and parent_id is null;

update public.menus
set sort_order = 13
where name = 'My Profile' and parent_id is null;

update public.menus
set sort_order = 14
where name = 'Change Password' and parent_id is null;

create table public.motions_for_execution (
  id bigint generated always as identity primary key,
  complaint_id bigint not null unique references public.complaints (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index motions_for_execution_created_at_idx
  on public.motions_for_execution (created_at desc);

alter table public.motions_for_execution enable row level security;
revoke all on table public.motions_for_execution from public, anon, authenticated;

create or replace function public.list_motion_for_execution_cases()
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
      c.id,
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
      ) as respondents
    from public.complaints c
    join public.amicable_settlements s on s.complaint_id = c.id
    where s.created_at < now() - interval '10 days'
      and not s.is_settled
      and not exists (
        select 1
        from public.repudiations r
        where r.complaint_id = c.id
      )
      and not exists (
        select 1
        from public.motions_for_execution m
        where m.complaint_id = c.id
      )
  ) as cases;

  return v_result;
end;
$$;

create or replace function public.create_motion_for_execution(
  p_complaint_id bigint,
  p_actor_user_id bigint
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case_no text;
  v_created_at timestamptz;
  v_is_settled boolean;
  v_id bigint;
  v_actor_name text;
begin
  perform public.require_activity_actor(p_actor_user_id);

  select c.barangay_case_no, s.created_at, s.is_settled
  into v_case_no, v_created_at, v_is_settled
  from public.complaints c
  join public.amicable_settlements s on s.complaint_id = c.id
  where c.id = p_complaint_id;

  if not found then
    raise exception 'This case has no amicable settlement.';
  end if;

  if v_is_settled then
    raise exception 'This settlement is already settled.';
  end if;

  if v_created_at >= now() - interval '10 days' then
    raise exception 'The ten-day period after this settlement has not expired.';
  end if;

  if exists (
    select 1
    from public.repudiations r
    where r.complaint_id = p_complaint_id
  ) then
    raise exception 'This settlement has a repudiation.';
  end if;

  if exists (
    select 1
    from public.motions_for_execution m
    where m.complaint_id = p_complaint_id
  ) then
    raise exception 'A motion for execution already exists for this case.';
  end if;

  insert into public.motions_for_execution (complaint_id)
  values (p_complaint_id)
  returning id into v_id;

  v_actor_name := public.user_display_name(p_actor_user_id);

  perform public.write_user_activity_log(
    p_actor_user_id,
    'add',
    public.menu_id_by_path('/motion-for-execution'),
    format('%s recorded a motion for execution (%s).', v_actor_name, v_case_no),
    null,
    jsonb_build_object(
      'motion_id', v_id,
      'complaint_id', p_complaint_id,
      'barangay_case_no', v_case_no
    )
  );

  return json_build_object('id', v_id);
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
      m.created_at
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

create or replace function public.get_motion_for_execution(p_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  select json_build_object(
    'id', m.id,
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
    'created_at', m.created_at
  )
  into v_result
  from public.motions_for_execution m
  join public.complaints c on c.id = m.complaint_id
  join public.amicable_settlements s on s.complaint_id = c.id
  left join public.complaint_types ct on ct.id = c.complaint_type_id
  where m.id = p_id;

  if v_result is null then
    raise exception 'Motion for execution not found';
  end if;

  return v_result;
end;
$$;

revoke all on function public.list_motion_for_execution_cases() from public;
grant execute on function public.list_motion_for_execution_cases() to anon, authenticated;

revoke all on function public.create_motion_for_execution(bigint, bigint) from public;
grant execute on function public.create_motion_for_execution(bigint, bigint) to anon, authenticated;

revoke all on function public.list_motions_for_execution(text, text, text, integer, integer) from public;
grant execute on function public.list_motions_for_execution(text, text, text, integer, integer) to anon, authenticated;

revoke all on function public.get_motion_for_execution(bigint) from public;
grant execute on function public.get_motion_for_execution(bigint) to anon, authenticated;

notify pgrst, 'reload schema';
