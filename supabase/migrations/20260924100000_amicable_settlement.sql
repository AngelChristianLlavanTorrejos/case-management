insert into public.menus (parent_id, name, icon, path, sort_order, is_active)
select null, 'Amicable Settlement', 'HeartHandshake', '/amicable-settlement', 6, true
where not exists (
  select 1 from public.menus where path = '/amicable-settlement'
);

update public.menus
set sort_order = 7
where name = 'Masterfile' and parent_id is null;

update public.menus
set sort_order = 8
where name = 'User Activity Log' and parent_id is null;

update public.menus
set sort_order = 9
where name = 'Baseline Security' and parent_id is null;

update public.menus
set sort_order = 10
where name = 'My Profile' and parent_id is null;

update public.menus
set sort_order = 11
where name = 'Change Password' and parent_id is null;

create table public.amicable_settlements (
  id bigint generated always as identity primary key,
  complaint_id bigint not null unique references public.complaints (id) on delete cascade,
  terms text not null,
  created_at timestamptz not null default now(),
  constraint amicable_settlements_terms_not_blank check (char_length(btrim(terms)) > 0)
);

create index amicable_settlements_created_at_idx
  on public.amicable_settlements (created_at desc);

alter table public.amicable_settlements enable row level security;
revoke all on table public.amicable_settlements from public, anon, authenticated;

create or replace function public.list_amicable_settlement_cases()
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
    where c.is_notice_and_summon_issued
      and c.barangay_case_no is not null
      and not exists (
        select 1
        from public.amicable_settlements s
        where s.complaint_id = c.id
      )
  ) as cases;

  return v_result;
end;
$$;

create or replace function public.create_amicable_settlement(
  p_complaint_id bigint,
  p_actor_user_id bigint,
  p_terms text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_issued boolean;
  v_case_no text;
  v_terms text;
  v_id bigint;
  v_actor_name text;
begin
  perform public.require_activity_actor(p_actor_user_id);

  v_terms := btrim(coalesce(p_terms, ''));
  if v_terms = '' then
    raise exception 'Settlement terms are required.';
  end if;

  select c.is_notice_and_summon_issued, c.barangay_case_no
  into v_issued, v_case_no
  from public.complaints c
  where c.id = p_complaint_id;

  if not found then
    raise exception 'Complaint not found';
  end if;

  if not v_issued or v_case_no is null then
    raise exception 'Notice of hearing and summon must be issued first.';
  end if;

  if exists (
    select 1
    from public.amicable_settlements s
    where s.complaint_id = p_complaint_id
  ) then
    raise exception 'An amicable settlement already exists for this case.';
  end if;

  insert into public.amicable_settlements (complaint_id, terms)
  values (p_complaint_id, v_terms)
  returning id into v_id;

  v_actor_name := public.user_display_name(p_actor_user_id);

  perform public.write_user_activity_log(
    p_actor_user_id,
    'add',
    public.menu_id_by_path('/amicable-settlement'),
    format('%s recorded an amicable settlement (%s).', v_actor_name, v_case_no),
    null,
    jsonb_build_object(
      'settlement_id', v_id,
      'complaint_id', p_complaint_id,
      'barangay_case_no', v_case_no
    )
  );

  return json_build_object('id', v_id);
end;
$$;

create or replace function public.list_amicable_settlements(
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
      s.id,
      s.complaint_id,
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
      s.created_at
    from public.amicable_settlements s
    join public.complaints c on c.id = s.complaint_id
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

create or replace function public.get_amicable_settlement(p_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  select json_build_object(
    'id', s.id,
    'complaint_id', s.complaint_id,
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
    'terms', s.terms,
    'created_at', s.created_at
  )
  into v_result
  from public.amicable_settlements s
  join public.complaints c on c.id = s.complaint_id
  left join public.complaint_types ct on ct.id = c.complaint_type_id
  where s.id = p_id;

  if v_result is null then
    raise exception 'Amicable settlement not found';
  end if;

  return v_result;
end;
$$;

revoke all on function public.list_amicable_settlement_cases() from public;
grant execute on function public.list_amicable_settlement_cases() to anon, authenticated;

revoke all on function public.create_amicable_settlement(bigint, bigint, text) from public;
grant execute on function public.create_amicable_settlement(bigint, bigint, text) to anon, authenticated;

revoke all on function public.list_amicable_settlements(text, text, text, integer, integer) from public;
grant execute on function public.list_amicable_settlements(text, text, text, integer, integer) to anon, authenticated;

revoke all on function public.get_amicable_settlement(bigint) from public;
grant execute on function public.get_amicable_settlement(bigint) to anon, authenticated;

notify pgrst, 'reload schema';
