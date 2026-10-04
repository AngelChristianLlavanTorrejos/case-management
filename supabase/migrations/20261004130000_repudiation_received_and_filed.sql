-- Repudiation: Users file without received date; staff mark received-and-filed later.

alter table public.repudiations
  alter column received_and_filed_on drop not null;

alter table public.repudiations
  add column if not exists received_and_filed_by bigint null references public.users (id) on delete set null;

create index if not exists repudiations_received_and_filed_by_idx
  on public.repudiations (received_and_filed_by);

create or replace function public.get_repudiation(p_id bigint, p_actor_user_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
  v_owner_id bigint;
  v_role_name text;
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

  select c.user_id
  into v_owner_id
  from public.repudiations rep
  join public.complaints c on c.id = rep.complaint_id
  where rep.id = p_id;

  if not found or (v_role_name = 'User' and v_owner_id is distinct from p_actor_user_id) then
    raise exception 'Repudiation not found';
  end if;

  select json_build_object(
    'id', rep.id,
    'complaint_id', rep.complaint_id,
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
    'fraud', rep.fraud,
    'fraud_details', coalesce(rep.fraud_details, ''),
    'violence', rep.violence,
    'violence_details', coalesce(rep.violence_details, ''),
    'intimidation', rep.intimidation,
    'intimidation_details', coalesce(rep.intimidation_details, ''),
    'sworn_on', rep.sworn_on,
    'received_and_filed_on', rep.received_and_filed_on,
    'received_and_filed_by_name', case
      when rep.received_and_filed_by is null then ''
      else coalesce(public.user_display_name(rep.received_and_filed_by), '')
    end,
    'created_at', rep.created_at
  )
  into v_result
  from public.repudiations rep
  join public.complaints c on c.id = rep.complaint_id
  left join public.complaint_types ct on ct.id = c.complaint_type_id
  where rep.id = p_id;

  if v_result is null then
    raise exception 'Repudiation not found';
  end if;

  return v_result;
end;
$$;

create or replace function public.list_repudiations(
  p_search text default '',
  p_sort_key text default 'created_at',
  p_sort_dir text default 'desc',
  p_page integer default 1,
  p_page_size integer default 10,
  p_actor_user_id bigint default null
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
  v_role_name text;
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

  v_offset := (v_page - 1) * v_page_size;

  with base as (
    select
      rep.id,
      rep.complaint_id,
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
      (rep.received_and_filed_on is not null) as is_received_and_filed,
      rep.received_and_filed_on,
      rep.created_at
    from public.repudiations rep
    join public.complaints c on c.id = rep.complaint_id
    where v_role_name <> 'User'
       or c.user_id = p_actor_user_id
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
  v_created_at timestamptz;
  v_status text;
  v_owner_id bigint;
  v_fraud boolean := coalesce(p_fraud, false);
  v_violence boolean := coalesce(p_violence, false);
  v_intimidation boolean := coalesce(p_intimidation, false);
  v_fraud_details text := btrim(coalesce(p_fraud_details, ''));
  v_violence_details text := btrim(coalesce(p_violence_details, ''));
  v_intimidation_details text := btrim(coalesce(p_intimidation_details, ''));
  v_id bigint;
  v_actor_name text;
  v_role_name text;
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

  if p_sworn_on is null then
    raise exception 'Sworn date is required.';
  end if;

  if v_role_name = 'User' then
    v_received_on := null;
    v_received_by := null;
  else
    if p_received_and_filed_on is null then
      raise exception 'Received and filed date is required.';
    end if;
    v_received_on := p_received_and_filed_on;
    v_received_by := p_actor_user_id;
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

  select c.barangay_case_no, s.created_at, s.status, c.user_id
  into v_case_no, v_created_at, v_status, v_owner_id
  from public.complaints c
  join public.amicable_settlements s on s.complaint_id = c.id
  where c.id = p_complaint_id;

  if not found then
    raise exception 'This case has no amicable settlement.';
  end if;

  if v_role_name = 'User' and v_owner_id is distinct from p_actor_user_id then
    raise exception 'You can only repudiate your own cases.';
  end if;

  if v_status is not null then
    raise exception 'This settlement already has an outcome.';
  end if;

  if v_created_at < now() - interval '10 days' then
    raise exception 'The ten-day period to repudiate this settlement has lapsed.';
  end if;

  if exists (
    select 1
    from public.repudiations rep
    where rep.complaint_id = p_complaint_id
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
    received_and_filed_on,
    received_and_filed_by
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
    v_received_on,
    v_received_by
  )
  returning id into v_id;

  update public.amicable_settlements
  set status = 'repudiated'
  where complaint_id = p_complaint_id
    and status is null;

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
    'update',
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

revoke all on function public.mark_repudiation_received_and_filed(bigint, bigint) from public;
grant execute on function public.mark_repudiation_received_and_filed(bigint, bigint) to anon, authenticated;

notify pgrst, 'reload schema';
