insert into public.menus (parent_id, name, icon, path, sort_order, is_active)
select null, 'Repudiation', 'Scale', '/repudiation', 7, true
where not exists (
  select 1 from public.menus where path = '/repudiation'
);

update public.menus
set sort_order = 8
where name = 'Masterfile' and parent_id is null;

update public.menus
set sort_order = 9
where name = 'User Activity Log' and parent_id is null;

update public.menus
set sort_order = 10
where name = 'Baseline Security' and parent_id is null;

update public.menus
set sort_order = 11
where name = 'My Profile' and parent_id is null;

update public.menus
set sort_order = 12
where name = 'Change Password' and parent_id is null;

create table public.repudiations (
  id bigint generated always as identity primary key,
  complaint_id bigint not null unique references public.complaints (id) on delete cascade,
  fraud boolean not null default false,
  fraud_details text,
  violence boolean not null default false,
  violence_details text,
  intimidation boolean not null default false,
  intimidation_details text,
  sworn_on date not null,
  received_and_filed_on date not null,
  created_at timestamptz not null default now()
);

create index repudiations_created_at_idx
  on public.repudiations (created_at desc);

alter table public.repudiations enable row level security;
revoke all on table public.repudiations from public, anon, authenticated;

create or replace function public.list_repudiation_cases()
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
    where s.created_at >= now() - interval '10 days'
      and not exists (
        select 1
        from public.repudiations r
        where r.complaint_id = c.id
      )
  ) as cases;

  return v_result;
end;
$$;

create or replace function public.create_repudiation(
  p_complaint_id bigint,
  p_actor_user_id bigint,
  p_fraud boolean,
  p_fraud_details text,
  p_violence boolean,
  p_violence_details text,
  p_intimidation boolean,
  p_intimidation_details text,
  p_sworn_on date,
  p_received_and_filed_on date
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case_no text;
  v_settled_at timestamptz;
  v_fraud boolean := coalesce(p_fraud, false);
  v_violence boolean := coalesce(p_violence, false);
  v_intimidation boolean := coalesce(p_intimidation, false);
  v_fraud_details text := btrim(coalesce(p_fraud_details, ''));
  v_violence_details text := btrim(coalesce(p_violence_details, ''));
  v_intimidation_details text := btrim(coalesce(p_intimidation_details, ''));
  v_id bigint;
  v_actor_name text;
begin
  perform public.require_activity_actor(p_actor_user_id);

  if p_sworn_on is null then
    raise exception 'Sworn date is required.';
  end if;

  if p_received_and_filed_on is null then
    raise exception 'Received and filed date is required.';
  end if;

  if not v_fraud and not v_violence and not v_intimidation then
    raise exception 'Select at least one ground for repudiation.';
  end if;

  if v_fraud and v_fraud_details = '' then
    raise exception 'Fraud details are required.';
  end if;

  if v_violence and v_violence_details = '' then
    raise exception 'Violence details are required.';
  end if;

  if v_intimidation and v_intimidation_details = '' then
    raise exception 'Intimidation details are required.';
  end if;

  select c.barangay_case_no, s.created_at
  into v_case_no, v_settled_at
  from public.complaints c
  join public.amicable_settlements s on s.complaint_id = c.id
  where c.id = p_complaint_id;

  if not found then
    raise exception 'This case has no amicable settlement.';
  end if;

  if v_settled_at < now() - interval '10 days' then
    raise exception 'The ten-day period to repudiate this settlement has lapsed.';
  end if;

  if exists (
    select 1
    from public.repudiations r
    where r.complaint_id = p_complaint_id
  ) then
    raise exception 'A repudiation already exists for this case.';
  end if;

  insert into public.repudiations (
    complaint_id,
    fraud,
    fraud_details,
    violence,
    violence_details,
    intimidation,
    intimidation_details,
    sworn_on,
    received_and_filed_on
  )
  values (
    p_complaint_id,
    v_fraud,
    case when v_fraud then v_fraud_details else null end,
    v_violence,
    case when v_violence then v_violence_details else null end,
    v_intimidation,
    case when v_intimidation then v_intimidation_details else null end,
    p_sworn_on,
    p_received_and_filed_on
  )
  returning id into v_id;

  v_actor_name := public.user_display_name(p_actor_user_id);

  perform public.write_user_activity_log(
    p_actor_user_id,
    'add',
    public.menu_id_by_path('/repudiation'),
    format('%s recorded a repudiation (%s).', v_actor_name, v_case_no),
    null,
    jsonb_build_object(
      'repudiation_id', v_id,
      'complaint_id', p_complaint_id,
      'barangay_case_no', v_case_no
    )
  );

  return json_build_object('id', v_id);
end;
$$;

create or replace function public.list_repudiations(
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
      r.id,
      r.complaint_id,
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
      r.created_at
    from public.repudiations r
    join public.complaints c on c.id = r.complaint_id
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

create or replace function public.get_repudiation(p_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  select json_build_object(
    'id', r.id,
    'complaint_id', r.complaint_id,
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
    'fraud', r.fraud,
    'fraud_details', coalesce(r.fraud_details, ''),
    'violence', r.violence,
    'violence_details', coalesce(r.violence_details, ''),
    'intimidation', r.intimidation,
    'intimidation_details', coalesce(r.intimidation_details, ''),
    'sworn_on', r.sworn_on,
    'received_and_filed_on', r.received_and_filed_on,
    'created_at', r.created_at
  )
  into v_result
  from public.repudiations r
  join public.complaints c on c.id = r.complaint_id
  left join public.complaint_types ct on ct.id = c.complaint_type_id
  where r.id = p_id;

  if v_result is null then
    raise exception 'Repudiation not found';
  end if;

  return v_result;
end;
$$;

revoke all on function public.list_repudiation_cases() from public;
grant execute on function public.list_repudiation_cases() to anon, authenticated;

revoke all on function public.create_repudiation(bigint, bigint, boolean, text, boolean, text, boolean, text, date, date) from public;
grant execute on function public.create_repudiation(bigint, bigint, boolean, text, boolean, text, boolean, text, date, date) to anon, authenticated;

revoke all on function public.list_repudiations(text, text, text, integer, integer) from public;
grant execute on function public.list_repudiations(text, text, text, integer, integer) to anon, authenticated;

revoke all on function public.get_repudiation(bigint) from public;
grant execute on function public.get_repudiation(bigint) to anon, authenticated;

notify pgrst, 'reload schema';
