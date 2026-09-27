create or replace function public.list_lupon_members(
  p_search text default '',
  p_sort_key text default 'display_name',
  p_sort_dir text default 'asc',
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
      u.id,
      public.user_display_name(u.id) as display_name,
      p.name as position_name,
      r.name as role_name,
      u.username,
      s.name as status_name
    from public.users u
    join public.positions p on p.id = u.position_id
    join public.roles r on r.id = u.role_id
    join public.status s on s.id = u.status_id
  ),
  filtered as (
    select *
    from base
    where v_search = ''
       or lower(display_name) like '%' || v_search || '%'
       or lower(position_name) like '%' || v_search || '%'
       or lower(role_name) like '%' || v_search || '%'
       or lower(username) like '%' || v_search || '%'
       or lower(status_name) like '%' || v_search || '%'
  ),
  counted as (
    select count(*)::integer as total from filtered
  ),
  paged as (
    select id, display_name, position_name, role_name, username, status_name
    from filtered
    order by
      case when p_sort_key = 'position_name' and p_sort_dir = 'asc' then position_name end asc,
      case when p_sort_key = 'position_name' and p_sort_dir = 'desc' then position_name end desc,
      case when p_sort_key = 'role_name' and p_sort_dir = 'asc' then role_name end asc,
      case when p_sort_key = 'role_name' and p_sort_dir = 'desc' then role_name end desc,
      case when p_sort_key = 'username' and p_sort_dir = 'asc' then username end asc,
      case when p_sort_key = 'username' and p_sort_dir = 'desc' then username end desc,
      case when p_sort_key = 'status_name' and p_sort_dir = 'asc' then status_name end asc,
      case when p_sort_key = 'status_name' and p_sort_dir = 'desc' then status_name end desc,
      case when p_sort_dir = 'desc' then display_name end desc,
      case when p_sort_dir is distinct from 'desc' then display_name end asc,
      id asc
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

create or replace function public.list_technical_support(
  p_search text default '',
  p_sort_key text default 'display_name',
  p_sort_dir text default 'asc',
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
      u.id,
      public.user_display_name(u.id) as display_name,
      r.name as role_name,
      u.username,
      s.name as status_name
    from public.users u
    join public.roles r on r.id = u.role_id
    join public.status s on s.id = u.status_id
    where r.name = 'Super Admin'
      and u.position_id is null
  ),
  filtered as (
    select *
    from base
    where v_search = ''
       or lower(display_name) like '%' || v_search || '%'
       or lower(role_name) like '%' || v_search || '%'
       or lower(username) like '%' || v_search || '%'
       or lower(status_name) like '%' || v_search || '%'
  ),
  counted as (
    select count(*)::integer as total from filtered
  ),
  paged as (
    select id, display_name, role_name, username, status_name
    from filtered
    order by
      case when p_sort_key = 'role_name' and p_sort_dir = 'asc' then role_name end asc,
      case when p_sort_key = 'role_name' and p_sort_dir = 'desc' then role_name end desc,
      case when p_sort_key = 'username' and p_sort_dir = 'asc' then username end asc,
      case when p_sort_key = 'username' and p_sort_dir = 'desc' then username end desc,
      case when p_sort_key = 'status_name' and p_sort_dir = 'asc' then status_name end asc,
      case when p_sort_key = 'status_name' and p_sort_dir = 'desc' then status_name end desc,
      case when p_sort_dir = 'desc' then display_name end desc,
      case when p_sort_dir is distinct from 'desc' then display_name end asc,
      id asc
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

create or replace function public.get_lupon_member(p_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  select json_build_object(
    'id', u.id,
    'username', u.username,
    'status_name', s.name,
    'role_name', r.name,
    'position_id', u.position_id,
    'position_name', p.name,
    'display_name', public.user_display_name(u.id),
    'first_name', pi.first_name,
    'middle_name', coalesce(pi.middle_name, ''),
    'last_name', pi.last_name,
    'suffix_id', pi.suffix_id,
    'suffix_name', sx.name,
    'sex_id', pi.sex_id,
    'sex_name', sxn.name,
    'civil_status_id', pi.civil_status_id,
    'civil_status_name', cs.name,
    'birthdate', pi.birthdate,
    'age', date_part('year', age(current_date, pi.birthdate))::integer,
    'present_address_house_block_lot', ci.present_address_house_block_lot,
    'present_address_street', ci.present_address_street,
    'present_address_barangay', ci.present_address_barangay,
    'present_address_municipality_city', ci.present_address_municipality_city,
    'present_address_province', ci.present_address_province,
    'present_address_region', ci.present_address_region,
    'present_address_zip_code', ci.present_address_zip_code,
    'permanent_address_house_block_lot', ci.permanent_address_house_block_lot,
    'permanent_address_street', ci.permanent_address_street,
    'permanent_address_barangay', ci.permanent_address_barangay,
    'permanent_address_municipality_city', ci.permanent_address_municipality_city,
    'permanent_address_province', ci.permanent_address_province,
    'permanent_address_region', ci.permanent_address_region,
    'permanent_address_zip_code', ci.permanent_address_zip_code,
    'mobile_number', ci.mobile_number,
    'telephone_number', coalesce(ci.telephone_number, ''),
    'email', ci.email
  )
  into v_result
  from public.users u
  join public.positions p on p.id = u.position_id
  join public.roles r on r.id = u.role_id
  join public.status s on s.id = u.status_id
  join public.personal_information pi on pi.user_id = u.id
  join public.contact_information ci on ci.user_id = u.id
  join public.suffixes sx on sx.id = pi.suffix_id
  join public.sex sxn on sxn.id = pi.sex_id
  join public.civil_status cs on cs.id = pi.civil_status_id
  where u.id = p_id;

  if v_result is null then
    raise exception 'Lupon member not found';
  end if;

  return v_result;
end;
$$;

create or replace function public.get_technical_support(p_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  select json_build_object(
    'id', u.id,
    'username', u.username,
    'status_name', s.name,
    'role_name', r.name,
    'display_name', public.user_display_name(u.id),
    'first_name', pi.first_name,
    'middle_name', coalesce(pi.middle_name, ''),
    'last_name', pi.last_name,
    'suffix_id', pi.suffix_id,
    'suffix_name', sx.name,
    'sex_id', pi.sex_id,
    'sex_name', sxn.name,
    'civil_status_id', pi.civil_status_id,
    'civil_status_name', cs.name,
    'birthdate', pi.birthdate,
    'age', date_part('year', age(current_date, pi.birthdate))::integer,
    'present_address_house_block_lot', ci.present_address_house_block_lot,
    'present_address_street', ci.present_address_street,
    'present_address_barangay', ci.present_address_barangay,
    'present_address_municipality_city', ci.present_address_municipality_city,
    'present_address_province', ci.present_address_province,
    'present_address_region', ci.present_address_region,
    'present_address_zip_code', ci.present_address_zip_code,
    'permanent_address_house_block_lot', ci.permanent_address_house_block_lot,
    'permanent_address_street', ci.permanent_address_street,
    'permanent_address_barangay', ci.permanent_address_barangay,
    'permanent_address_municipality_city', ci.permanent_address_municipality_city,
    'permanent_address_province', ci.permanent_address_province,
    'permanent_address_region', ci.permanent_address_region,
    'permanent_address_zip_code', ci.permanent_address_zip_code,
    'mobile_number', ci.mobile_number,
    'telephone_number', coalesce(ci.telephone_number, ''),
    'email', ci.email
  )
  into v_result
  from public.users u
  join public.roles r on r.id = u.role_id
  join public.status s on s.id = u.status_id
  join public.personal_information pi on pi.user_id = u.id
  join public.contact_information ci on ci.user_id = u.id
  join public.suffixes sx on sx.id = pi.suffix_id
  join public.sex sxn on sxn.id = pi.sex_id
  join public.civil_status cs on cs.id = pi.civil_status_id
  where u.id = p_id
    and r.name = 'Super Admin'
    and u.position_id is null;

  if v_result is null then
    raise exception 'Technical support account not found';
  end if;

  return v_result;
end;
$$;

create or replace function public.update_lupon_member(
  p_id bigint,
  p_position_id bigint,
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
  p_actor_user_id bigint
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_position_name text;
  v_role_id bigint;
  v_role_name text;
  v_old jsonb;
  v_new jsonb;
  v_actor_name text;
  v_member_name text;
begin
  perform public.require_activity_actor(p_actor_user_id);

  if not exists (
    select 1
    from public.users
    where id = p_id
      and position_id is not null
  ) then
    raise exception 'Lupon member not found';
  end if;

  select name
  into v_position_name
  from public.positions
  where id = p_position_id;

  if v_position_name is null then
    raise exception 'Position is required.';
  end if;

  if v_position_name = 'Lupon Chairman/Barangay Chairman' then
    v_role_name := 'Super Admin';
  else
    v_role_name := 'Admin';
  end if;

  select id into v_role_id from public.roles where name = v_role_name;
  if v_role_id is null then
    raise exception '% role is not configured', v_role_name;
  end if;

  if exists (
    select 1 from public.contact_information
    where email = p_email and user_id is distinct from p_id
  ) then
    raise exception 'Email is already registered';
  end if;

  v_old := public.get_lupon_member(p_id)::jsonb;
  v_member_name := public.user_display_name(p_id);
  v_actor_name := public.user_display_name(p_actor_user_id);

  update public.users
  set
    position_id = p_position_id,
    role_id = v_role_id
  where id = p_id;

  update public.personal_information
  set
    first_name = p_first_name,
    middle_name = nullif(btrim(p_middle_name), ''),
    last_name = p_last_name,
    suffix_id = p_suffix_id,
    sex_id = p_sex_id,
    civil_status_id = p_civil_status_id,
    birthdate = p_birthdate
  where user_id = p_id;

  update public.contact_information
  set
    present_address_house_block_lot = p_present_address_house_block_lot,
    present_address_street = p_present_address_street,
    present_address_barangay = p_present_address_barangay,
    present_address_municipality_city = p_present_address_municipality_city,
    present_address_province = p_present_address_province,
    present_address_region = p_present_address_region,
    present_address_zip_code = p_present_address_zip_code,
    permanent_address_house_block_lot = p_permanent_address_house_block_lot,
    permanent_address_street = p_permanent_address_street,
    permanent_address_barangay = p_permanent_address_barangay,
    permanent_address_municipality_city = p_permanent_address_municipality_city,
    permanent_address_province = p_permanent_address_province,
    permanent_address_region = p_permanent_address_region,
    permanent_address_zip_code = p_permanent_address_zip_code,
    mobile_number = p_mobile_number,
    telephone_number = nullif(btrim(p_telephone_number), ''),
    email = p_email
  where user_id = p_id;

  v_new := public.get_lupon_member(p_id)::jsonb;

  perform public.write_user_activity_log(
    p_actor_user_id,
    'edit',
    public.menu_id_by_path('/lupon-members'),
    format('%s updated %s.', v_actor_name, v_member_name),
    v_old,
    v_new
  );

  return public.get_lupon_member(p_id);
end;
$$;

create or replace function public.update_technical_support(
  p_id bigint,
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
  p_actor_user_id bigint
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_actor_name text;
  v_member_name text;
begin
  perform public.require_activity_actor(p_actor_user_id);

  if not exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = p_id
      and r.name = 'Super Admin'
      and u.position_id is null
  ) then
    raise exception 'Technical support account not found';
  end if;

  if exists (
    select 1 from public.contact_information
    where email = p_email and user_id is distinct from p_id
  ) then
    raise exception 'Email is already registered';
  end if;

  v_old := public.get_technical_support(p_id)::jsonb;
  v_member_name := public.user_display_name(p_id);
  v_actor_name := public.user_display_name(p_actor_user_id);

  update public.personal_information
  set
    first_name = p_first_name,
    middle_name = nullif(btrim(p_middle_name), ''),
    last_name = p_last_name,
    suffix_id = p_suffix_id,
    sex_id = p_sex_id,
    civil_status_id = p_civil_status_id,
    birthdate = p_birthdate
  where user_id = p_id;

  update public.contact_information
  set
    present_address_house_block_lot = p_present_address_house_block_lot,
    present_address_street = p_present_address_street,
    present_address_barangay = p_present_address_barangay,
    present_address_municipality_city = p_present_address_municipality_city,
    present_address_province = p_present_address_province,
    present_address_region = p_present_address_region,
    present_address_zip_code = p_present_address_zip_code,
    permanent_address_house_block_lot = p_permanent_address_house_block_lot,
    permanent_address_street = p_permanent_address_street,
    permanent_address_barangay = p_permanent_address_barangay,
    permanent_address_municipality_city = p_permanent_address_municipality_city,
    permanent_address_province = p_permanent_address_province,
    permanent_address_region = p_permanent_address_region,
    permanent_address_zip_code = p_permanent_address_zip_code,
    mobile_number = p_mobile_number,
    telephone_number = nullif(btrim(p_telephone_number), ''),
    email = p_email
  where user_id = p_id;

  v_new := public.get_technical_support(p_id)::jsonb;

  perform public.write_user_activity_log(
    p_actor_user_id,
    'edit',
    public.menu_id_by_path('/technical-support'),
    format('%s updated %s.', v_actor_name, v_member_name),
    v_old,
    v_new
  );

  return public.get_technical_support(p_id);
end;
$$;

create or replace function public.restrict_lupon_member(p_id bigint, p_actor_user_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status_id bigint;
  v_old jsonb;
  v_new jsonb;
  v_actor_name text;
  v_member_name text;
begin
  perform public.require_activity_actor(p_actor_user_id);

  if p_id = p_actor_user_id then
    raise exception 'You cannot restrict your own account';
  end if;

  if not exists (
    select 1
    from public.users u
    join public.status s on s.id = u.status_id
    where u.id = p_id
      and u.position_id is not null
      and lower(s.name) = 'active'
  ) then
    raise exception 'Active lupon member not found';
  end if;

  select id into v_status_id from public.status where lower(name) = 'inactive';
  if v_status_id is null then
    raise exception 'Inactive status is not configured';
  end if;

  v_old := public.get_lupon_member(p_id)::jsonb;
  v_member_name := public.user_display_name(p_id);
  v_actor_name := public.user_display_name(p_actor_user_id);

  update public.users
  set status_id = v_status_id
  where id = p_id;

  v_new := public.get_lupon_member(p_id)::jsonb;

  perform public.write_user_activity_log(
    p_actor_user_id,
    'restrict',
    public.menu_id_by_path('/lupon-members'),
    format('%s restricted %s.', v_actor_name, v_member_name),
    v_old,
    v_new
  );

  return json_build_object('ok', true, 'id', p_id);
end;
$$;

create or replace function public.allow_lupon_member(p_id bigint, p_actor_user_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status_id bigint;
  v_old jsonb;
  v_new jsonb;
  v_actor_name text;
  v_member_name text;
begin
  perform public.require_activity_actor(p_actor_user_id);

  if not exists (
    select 1
    from public.users u
    join public.status s on s.id = u.status_id
    where u.id = p_id
      and u.position_id is not null
      and lower(s.name) = 'inactive'
  ) then
    raise exception 'Inactive lupon member not found';
  end if;

  select id into v_status_id from public.status where lower(name) = 'active';
  if v_status_id is null then
    raise exception 'Active status is not configured';
  end if;

  v_old := public.get_lupon_member(p_id)::jsonb;
  v_member_name := public.user_display_name(p_id);
  v_actor_name := public.user_display_name(p_actor_user_id);

  update public.users
  set status_id = v_status_id
  where id = p_id;

  v_new := public.get_lupon_member(p_id)::jsonb;

  perform public.write_user_activity_log(
    p_actor_user_id,
    'allow',
    public.menu_id_by_path('/lupon-members'),
    format('%s allowed %s.', v_actor_name, v_member_name),
    v_old,
    v_new
  );

  return json_build_object('ok', true, 'id', p_id);
end;
$$;

create or replace function public.delete_lupon_member(p_id bigint, p_actor_user_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_actor_name text;
  v_member_name text;
begin
  perform public.require_activity_actor(p_actor_user_id);

  if p_id = p_actor_user_id then
    raise exception 'You cannot delete your own account';
  end if;

  if not exists (
    select 1
    from public.users
    where id = p_id
      and position_id is not null
  ) then
    raise exception 'Lupon member not found';
  end if;

  v_old := public.get_lupon_member(p_id)::jsonb;
  v_member_name := public.user_display_name(p_id);
  v_actor_name := public.user_display_name(p_actor_user_id);

  delete from public.users where id = p_id;

  perform public.write_user_activity_log(
    p_actor_user_id,
    'delete',
    public.menu_id_by_path('/lupon-members'),
    format('%s deleted %s.', v_actor_name, v_member_name),
    v_old,
    null
  );

  return json_build_object('ok', true, 'id', p_id);
end;
$$;

create or replace function public.restrict_technical_support(p_id bigint, p_actor_user_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status_id bigint;
  v_old jsonb;
  v_new jsonb;
  v_actor_name text;
  v_member_name text;
begin
  perform public.require_activity_actor(p_actor_user_id);

  if p_id = p_actor_user_id then
    raise exception 'You cannot restrict your own account';
  end if;

  if not exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    join public.status s on s.id = u.status_id
    where u.id = p_id
      and r.name = 'Super Admin'
      and u.position_id is null
      and lower(s.name) = 'active'
  ) then
    raise exception 'Active technical support account not found';
  end if;

  select id into v_status_id from public.status where lower(name) = 'inactive';
  if v_status_id is null then
    raise exception 'Inactive status is not configured';
  end if;

  v_old := public.get_technical_support(p_id)::jsonb;
  v_member_name := public.user_display_name(p_id);
  v_actor_name := public.user_display_name(p_actor_user_id);

  update public.users
  set status_id = v_status_id
  where id = p_id;

  v_new := public.get_technical_support(p_id)::jsonb;

  perform public.write_user_activity_log(
    p_actor_user_id,
    'restrict',
    public.menu_id_by_path('/technical-support'),
    format('%s restricted %s.', v_actor_name, v_member_name),
    v_old,
    v_new
  );

  return json_build_object('ok', true, 'id', p_id);
end;
$$;

create or replace function public.allow_technical_support(p_id bigint, p_actor_user_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status_id bigint;
  v_old jsonb;
  v_new jsonb;
  v_actor_name text;
  v_member_name text;
begin
  perform public.require_activity_actor(p_actor_user_id);

  if not exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    join public.status s on s.id = u.status_id
    where u.id = p_id
      and r.name = 'Super Admin'
      and u.position_id is null
      and lower(s.name) = 'inactive'
  ) then
    raise exception 'Inactive technical support account not found';
  end if;

  select id into v_status_id from public.status where lower(name) = 'active';
  if v_status_id is null then
    raise exception 'Active status is not configured';
  end if;

  v_old := public.get_technical_support(p_id)::jsonb;
  v_member_name := public.user_display_name(p_id);
  v_actor_name := public.user_display_name(p_actor_user_id);

  update public.users
  set status_id = v_status_id
  where id = p_id;

  v_new := public.get_technical_support(p_id)::jsonb;

  perform public.write_user_activity_log(
    p_actor_user_id,
    'allow',
    public.menu_id_by_path('/technical-support'),
    format('%s allowed %s.', v_actor_name, v_member_name),
    v_old,
    v_new
  );

  return json_build_object('ok', true, 'id', p_id);
end;
$$;

create or replace function public.delete_technical_support(p_id bigint, p_actor_user_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_actor_name text;
  v_member_name text;
begin
  perform public.require_activity_actor(p_actor_user_id);

  if p_id = p_actor_user_id then
    raise exception 'You cannot delete your own account';
  end if;

  if not exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = p_id
      and r.name = 'Super Admin'
      and u.position_id is null
  ) then
    raise exception 'Technical support account not found';
  end if;

  if (
    select count(*)
    from public.users u
    join public.roles r on r.id = u.role_id
    where r.name = 'Super Admin'
      and u.position_id is null
  ) <= 1 then
    raise exception 'Cannot delete the last technical support account';
  end if;

  v_old := public.get_technical_support(p_id)::jsonb;
  v_member_name := public.user_display_name(p_id);
  v_actor_name := public.user_display_name(p_actor_user_id);

  delete from public.users where id = p_id;

  perform public.write_user_activity_log(
    p_actor_user_id,
    'delete',
    public.menu_id_by_path('/technical-support'),
    format('%s deleted %s.', v_actor_name, v_member_name),
    v_old,
    null
  );

  return json_build_object('ok', true, 'id', p_id);
end;
$$;

revoke all on function public.get_lupon_member(bigint) from public;
revoke all on function public.get_technical_support(bigint) from public;
revoke all on function public.update_lupon_member(
  bigint, bigint,
  text, text, text, bigint, bigint, bigint, date,
  text, text, text, text, text, text, text,
  text, text, text, text, text, text, text,
  text, text, text, bigint
) from public;
revoke all on function public.update_technical_support(
  bigint,
  text, text, text, bigint, bigint, bigint, date,
  text, text, text, text, text, text, text,
  text, text, text, text, text, text, text,
  text, text, text, bigint
) from public;
revoke all on function public.restrict_lupon_member(bigint, bigint) from public;
revoke all on function public.allow_lupon_member(bigint, bigint) from public;
revoke all on function public.delete_lupon_member(bigint, bigint) from public;
revoke all on function public.restrict_technical_support(bigint, bigint) from public;
revoke all on function public.allow_technical_support(bigint, bigint) from public;
revoke all on function public.delete_technical_support(bigint, bigint) from public;

grant execute on function public.get_lupon_member(bigint) to anon, authenticated;
grant execute on function public.get_technical_support(bigint) to anon, authenticated;
grant execute on function public.update_lupon_member(
  bigint, bigint,
  text, text, text, bigint, bigint, bigint, date,
  text, text, text, text, text, text, text,
  text, text, text, text, text, text, text,
  text, text, text, bigint
) to anon, authenticated;
grant execute on function public.update_technical_support(
  bigint,
  text, text, text, bigint, bigint, bigint, date,
  text, text, text, text, text, text, text,
  text, text, text, text, text, text, text,
  text, text, text, bigint
) to anon, authenticated;
grant execute on function public.restrict_lupon_member(bigint, bigint) to anon, authenticated;
grant execute on function public.allow_lupon_member(bigint, bigint) to anon, authenticated;
grant execute on function public.delete_lupon_member(bigint, bigint) to anon, authenticated;
grant execute on function public.restrict_technical_support(bigint, bigint) to anon, authenticated;
grant execute on function public.allow_technical_support(bigint, bigint) to anon, authenticated;
grant execute on function public.delete_technical_support(bigint, bigint) to anon, authenticated;

notify pgrst, 'reload schema';
