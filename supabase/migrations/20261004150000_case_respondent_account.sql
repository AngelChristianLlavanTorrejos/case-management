-- One respondent User account per community-filed case; repudiation access + dual SMS notify.

alter table public.complaints
  add column if not exists respondent_user_id bigint null references public.users (id) on delete set null;

create unique index if not exists complaints_respondent_user_id_uidx
  on public.complaints (respondent_user_id)
  where respondent_user_id is not null;

alter table public.repudiations
  add column if not exists filed_by_user_id bigint null references public.users (id) on delete set null;

create index if not exists repudiations_filed_by_user_id_idx
  on public.repudiations (filed_by_user_id);

-- Backfill filed_by from activity log is skipped; new rows set it on create.

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
  v_owner_id bigint;
  v_respondent_id bigint;
  v_owner_role text;
  v_requires boolean := false;
begin
  perform public.require_activity_actor(p_actor_user_id);

  v_terms := btrim(coalesce(p_terms, ''));
  if v_terms = '' then
    raise exception 'Settlement terms are required.';
  end if;

  select
    c.is_notice_and_summon_issued,
    c.barangay_case_no,
    c.user_id,
    c.respondent_user_id,
    r.name
  into v_issued, v_case_no, v_owner_id, v_respondent_id, v_owner_role
  from public.complaints c
  join public.users u on u.id = c.user_id
  join public.roles r on r.id = u.role_id
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

  v_requires := (v_owner_role = 'User' and v_respondent_id is null);

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
      'barangay_case_no', v_case_no,
      'requires_respondent_account', v_requires
    )
  );

  return json_build_object(
    'id', v_id,
    'complaint_id', p_complaint_id,
    'requires_respondent_account', v_requires
  );
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
      s.created_at,
      s.is_settled,
      s.status,
      (
        owner_role.name = 'User'
        and c.respondent_user_id is null
      ) as requires_respondent_account
    from public.amicable_settlements s
    join public.complaints c on c.id = s.complaint_id
    join public.users owner_u on owner_u.id = c.user_id
    join public.roles owner_role on owner_role.id = owner_u.role_id
  ),
  filtered as (
    select *
    from base
    where v_search = ''
       or lower(coalesce(barangay_case_no, '')) like '%' || v_search || '%'
       or lower(complainants) like '%' || v_search || '%'
       or lower(respondents) like '%' || v_search || '%'
       or lower(coalesce(status, '')) like '%' || v_search || '%'
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
      case when p_sort_key = 'status' and p_sort_dir = 'asc' then status end asc,
      case when p_sort_key = 'status' and p_sort_dir = 'desc' then status end desc,
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

create or replace function public.create_and_link_case_respondent(
  p_complaint_id bigint,
  p_actor_user_id bigint,
  p_first_name text,
  p_middle_name text,
  p_last_name text,
  p_suffix_id bigint,
  p_sex_id bigint,
  p_civil_status_id bigint,
  p_birthdate date,
  p_present_address_house_block_lot text,
  p_present_address_street text,
  p_present_address_barangay text,
  p_present_address_municipality_city text,
  p_present_address_province text,
  p_present_address_region text,
  p_present_address_zip_code text,
  p_permanent_address_house_block_lot text,
  p_permanent_address_street text,
  p_permanent_address_barangay text,
  p_permanent_address_municipality_city text,
  p_permanent_address_province text,
  p_permanent_address_region text,
  p_permanent_address_zip_code text,
  p_mobile_number text,
  p_telephone_number text,
  p_email text,
  p_username text,
  p_password text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
  v_owner_role text;
  v_respondent_id bigint;
  v_case_no text;
  v_has_settlement boolean;
  v_role_id bigint;
  v_status_id bigint;
  v_user_id bigint;
  v_actor_name text;
  v_username text := btrim(coalesce(p_username, ''));
  v_email text := btrim(coalesce(p_email, ''));
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
    raise exception 'You cannot create a respondent account for this case.';
  end if;

  select
    c.barangay_case_no,
    c.respondent_user_id,
    owner_role.name,
    exists (
      select 1 from public.amicable_settlements s where s.complaint_id = c.id
    )
  into v_case_no, v_respondent_id, v_owner_role, v_has_settlement
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

  select id into v_role_id from public.roles where name = 'User';
  if v_role_id is null then
    raise exception 'User role is not configured';
  end if;

  select id into v_status_id from public.status where lower(name) = 'active';
  if v_status_id is null then
    raise exception 'Active status is not configured';
  end if;

  if char_length(v_username) < 3 then
    raise exception 'Username must be at least 3 characters';
  end if;

  if exists (select 1 from public.users where username = v_username) then
    raise exception 'Username is already taken';
  end if;

  if exists (select 1 from public.contact_information where email = v_email) then
    raise exception 'Email is already registered';
  end if;

  insert into public.users (
    role_id,
    position_id,
    username,
    password,
    status_id,
    should_change_password
  )
  values (
    v_role_id,
    null,
    v_username,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    v_status_id,
    false
  )
  returning id into v_user_id;

  insert into public.personal_information (
    user_id,
    first_name,
    middle_name,
    last_name,
    suffix_id,
    sex_id,
    civil_status_id,
    birthdate
  )
  values (
    v_user_id,
    p_first_name,
    nullif(trim(p_middle_name), ''),
    p_last_name,
    p_suffix_id,
    p_sex_id,
    p_civil_status_id,
    p_birthdate
  );

  insert into public.contact_information (
    user_id,
    present_address_house_block_lot,
    present_address_street,
    present_address_barangay,
    present_address_municipality_city,
    present_address_province,
    present_address_region,
    present_address_zip_code,
    permanent_address_house_block_lot,
    permanent_address_street,
    permanent_address_barangay,
    permanent_address_municipality_city,
    permanent_address_province,
    permanent_address_region,
    permanent_address_zip_code,
    mobile_number,
    telephone_number,
    email
  )
  values (
    v_user_id,
    p_present_address_house_block_lot,
    p_present_address_street,
    p_present_address_barangay,
    p_present_address_municipality_city,
    p_present_address_province,
    p_present_address_region,
    p_present_address_zip_code,
    p_permanent_address_house_block_lot,
    p_permanent_address_street,
    p_permanent_address_barangay,
    p_permanent_address_municipality_city,
    p_permanent_address_province,
    p_permanent_address_region,
    p_permanent_address_zip_code,
    p_mobile_number,
    nullif(trim(p_telephone_number), ''),
    v_email
  );

  update public.complaints
  set respondent_user_id = v_user_id
  where id = p_complaint_id;

  v_actor_name := public.user_display_name(p_actor_user_id);

  perform public.write_user_activity_log(
    p_actor_user_id,
    'add',
    public.menu_id_by_path('/amicable-settlement'),
    format(
      '%s created and linked a respondent account for case %s (%s).',
      v_actor_name,
      coalesce(v_case_no, '—'),
      v_username
    ),
    null,
    jsonb_build_object(
      'complaint_id', p_complaint_id,
      'barangay_case_no', v_case_no,
      'respondent_user_id', v_user_id,
      'username', v_username
    )
  );

  return json_build_object(
    'id', v_user_id,
    'complaint_id', p_complaint_id,
    'username', v_username
  );
end;
$$;

create or replace function public.get_repudiation(p_id bigint, p_actor_user_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
  v_owner_id bigint;
  v_respondent_id bigint;
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

  select c.user_id, c.respondent_user_id
  into v_owner_id, v_respondent_id
  from public.repudiations rep
  join public.complaints c on c.id = rep.complaint_id
  where rep.id = p_id;

  if not found
     or (
       v_role_name = 'User'
       and v_owner_id is distinct from p_actor_user_id
       and v_respondent_id is distinct from p_actor_user_id
     )
  then
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
    'filed_by_user_id', rep.filed_by_user_id,
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
       or c.respondent_user_id = p_actor_user_id
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

create or replace function public.list_repudiation_cases(p_actor_user_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
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
      and s.status is null
      and not exists (
        select 1
        from public.repudiations rep
        where rep.complaint_id = c.id
      )
      and (
        v_role_name <> 'User'
        or c.user_id = p_actor_user_id
        or c.respondent_user_id = p_actor_user_id
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
  v_created_at timestamptz;
  v_status text;
  v_owner_id bigint;
  v_respondent_id bigint;
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

  select c.barangay_case_no, s.created_at, s.status, c.user_id, c.respondent_user_id
  into v_case_no, v_created_at, v_status, v_owner_id, v_respondent_id
  from public.complaints c
  join public.amicable_settlements s on s.complaint_id = c.id
  where c.id = p_complaint_id;

  if not found then
    raise exception 'This case has no amicable settlement.';
  end if;

  if v_role_name = 'User'
     and v_owner_id is distinct from p_actor_user_id
     and v_respondent_id is distinct from p_actor_user_id
  then
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
    received_and_filed_by,
    filed_by_user_id
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
    v_received_by,
    p_actor_user_id
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
      'barangay_case_no', v_case_no,
      'filed_by_user_id', p_actor_user_id
    )
  );

  return json_build_object('id', v_id);
end;
$$;

create or replace function public.get_repudiation_notify_info(p_complaint_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  select json_build_object(
    'barangay_case_no', c.barangay_case_no,
    'creator_role', coalesce(owner_role.name, ''),
    'recipients', coalesce(
      (
        select json_agg(json_build_object('mobile_number', t.mobile_number))
        from (
          select distinct nullif(btrim(ci.mobile_number), '') as mobile_number
          from (
            select c.user_id as uid
            union all
            select c.respondent_user_id
          ) parties
          join public.contact_information ci on ci.user_id = parties.uid
          where parties.uid is not null
            and nullif(btrim(ci.mobile_number), '') is not null
        ) t
      ),
      '[]'::json
    )
  )
  into v_result
  from public.complaints c
  join public.users owner_u on owner_u.id = c.user_id
  join public.roles owner_role on owner_role.id = owner_u.role_id
  where c.id = p_complaint_id;

  if v_result is null then
    raise exception 'Complaint not found';
  end if;

  return v_result;
end;
$$;

revoke all on function public.create_and_link_case_respondent(
  bigint, bigint, text, text, text, bigint, bigint, bigint, date,
  text, text, text, text, text, text, text,
  text, text, text, text, text, text, text,
  text, text, text, text, text
) from public;

grant execute on function public.create_and_link_case_respondent(
  bigint, bigint, text, text, text, bigint, bigint, bigint, date,
  text, text, text, text, text, text, text,
  text, text, text, text, text, text, text,
  text, text, text, text, text
) to anon, authenticated;

revoke all on function public.get_repudiation_notify_info(bigint) from public;
grant execute on function public.get_repudiation_notify_info(bigint) to anon, authenticated;

notify pgrst, 'reload schema';
