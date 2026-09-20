create or replace function public.login_user(p_username text, p_password text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users%rowtype;
  v_role_name text;
  v_status_name text;
begin
  select * into v_user
  from public.users
  where username = p_username;

  if not found
     or v_user.password is distinct from extensions.crypt(p_password, v_user.password) then
    raise exception 'Invalid username or password';
  end if;

  select name into v_status_name from public.status where id = v_user.status_id;

  if lower(v_status_name) = 'for registration' then
    raise exception 'Your account is waiting for approval.';
  end if;

  if lower(v_status_name) = 'inactive' then
    raise exception 'Your account is inactive.';
  end if;

  if lower(coalesce(v_status_name, '')) is distinct from 'active' then
    raise exception 'Your account cannot sign in.';
  end if;

  select name into v_role_name from public.roles where id = v_user.role_id;

  return json_build_object(
    'id', v_user.id,
    'username', v_user.username,
    'role_name', v_role_name,
    'status_name', v_status_name,
    'display_name', public.user_display_name(v_user.id)
  );
end;
$$;

create or replace function public.list_community_members(
  p_status_group text,
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
  if p_status_group not in ('requests', 'residents') then
    raise exception 'Invalid status group';
  end if;

  v_offset := (v_page - 1) * v_page_size;

  with base as (
    select
      u.id,
      public.user_display_name(u.id) as display_name,
      date_part('year', age(current_date, pi.birthdate))::integer as age,
      sxn.name as sex_name,
      concat_ws(', ', ci.present_address_barangay, ci.present_address_municipality_city) as location,
      s.name as status_name
    from public.users u
    join public.roles r on r.id = u.role_id
    join public.status s on s.id = u.status_id
    join public.personal_information pi on pi.user_id = u.id
    join public.sex sxn on sxn.id = pi.sex_id
    join public.contact_information ci on ci.user_id = u.id
    where r.name = 'User'
      and (
        (p_status_group = 'requests' and lower(s.name) = 'for registration')
        or (p_status_group = 'residents' and lower(s.name) in ('active', 'inactive'))
      )
  ),
  filtered as (
    select *
    from base
    where v_search = ''
       or lower(display_name) like '%' || v_search || '%'
       or lower(location) like '%' || v_search || '%'
  ),
  counted as (
    select count(*)::integer as total from filtered
  ),
  paged as (
    select id, display_name, age, sex_name, location, status_name
    from filtered
    order by
      case when p_sort_key = 'age' and p_sort_dir = 'asc' then age end asc,
      case when p_sort_key = 'age' and p_sort_dir = 'desc' then age end desc,
      case when p_sort_key = 'sex_name' and p_sort_dir = 'asc' then sex_name end asc,
      case when p_sort_key = 'sex_name' and p_sort_dir = 'desc' then sex_name end desc,
      case when p_sort_key = 'location' and p_sort_dir = 'asc' then location end asc,
      case when p_sort_key = 'location' and p_sort_dir = 'desc' then location end desc,
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

create or replace function public.get_community_member(p_id bigint)
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
    'email', ci.email,
    'location', concat_ws(', ', ci.present_address_barangay, ci.present_address_municipality_city)
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
    and r.name = 'User';

  if v_result is null then
    raise exception 'Community member not found';
  end if;

  return v_result;
end;
$$;

create or replace function public.approve_community_member(p_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status_id bigint;
begin
  if not exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    join public.status s on s.id = u.status_id
    where u.id = p_id
      and r.name = 'User'
      and lower(s.name) = 'for registration'
  ) then
    raise exception 'Registration request not found';
  end if;

  select id into v_status_id from public.status where lower(name) = 'active';
  if v_status_id is null then
    raise exception 'Active status is not configured';
  end if;

  update public.users
  set status_id = v_status_id
  where id = p_id;

  return json_build_object('ok', true, 'id', p_id);
end;
$$;

create or replace function public.disapprove_community_member(p_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    join public.status s on s.id = u.status_id
    where u.id = p_id
      and r.name = 'User'
      and lower(s.name) = 'for registration'
  ) then
    raise exception 'Registration request not found';
  end if;

  delete from public.users where id = p_id;

  return json_build_object('ok', true, 'id', p_id);
end;
$$;

create or replace function public.restrict_community_member(p_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status_id bigint;
begin
  if not exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    join public.status s on s.id = u.status_id
    where u.id = p_id
      and r.name = 'User'
      and lower(s.name) = 'active'
  ) then
    raise exception 'Active resident not found';
  end if;

  select id into v_status_id from public.status where lower(name) = 'inactive';
  if v_status_id is null then
    raise exception 'Inactive status is not configured';
  end if;

  update public.users
  set status_id = v_status_id
  where id = p_id;

  return json_build_object('ok', true, 'id', p_id);
end;
$$;

create or replace function public.delete_community_member(p_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    join public.status s on s.id = u.status_id
    where u.id = p_id
      and r.name = 'User'
      and lower(s.name) in ('active', 'inactive')
  ) then
    raise exception 'Registered resident not found';
  end if;

  delete from public.users where id = p_id;

  return json_build_object('ok', true, 'id', p_id);
end;
$$;

create or replace function public.update_community_member(
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
  p_email text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    join public.status s on s.id = u.status_id
    where u.id = p_id
      and r.name = 'User'
      and lower(s.name) in ('active', 'inactive')
  ) then
    raise exception 'Registered resident not found';
  end if;

  if exists (
    select 1 from public.contact_information
    where email = p_email and user_id is distinct from p_id
  ) then
    raise exception 'Email is already registered';
  end if;

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

  return public.get_community_member(p_id);
end;
$$;

insert into public.menus (parent_id, name, icon, path, sort_order, is_active)
select null, 'Community Members', 'Users', '/community-members', 2, true
where not exists (
  select 1 from public.menus where name = 'Community Members' and parent_id is null
);

update public.menus
set sort_order = 3
where name = 'Masterfile' and parent_id is null;

revoke all on function public.login_user(text, text) from public;
grant execute on function public.login_user(text, text) to anon, authenticated;

revoke all on function public.list_community_members(text, text, text, text, integer, integer) from public;
revoke all on function public.get_community_member(bigint) from public;
revoke all on function public.approve_community_member(bigint) from public;
revoke all on function public.disapprove_community_member(bigint) from public;
revoke all on function public.restrict_community_member(bigint) from public;
revoke all on function public.delete_community_member(bigint) from public;
revoke all on function public.update_community_member(
  bigint, text, text, text, bigint, bigint, bigint, date,
  text, text, text, text, text, text, text,
  text, text, text, text, text, text, text,
  text, text, text
) from public;

grant execute on function public.list_community_members(text, text, text, text, integer, integer) to anon, authenticated;
grant execute on function public.get_community_member(bigint) to anon, authenticated;
grant execute on function public.approve_community_member(bigint) to anon, authenticated;
grant execute on function public.disapprove_community_member(bigint) to anon, authenticated;
grant execute on function public.restrict_community_member(bigint) to anon, authenticated;
grant execute on function public.delete_community_member(bigint) to anon, authenticated;
grant execute on function public.update_community_member(
  bigint, text, text, text, bigint, bigint, bigint, date,
  text, text, text, text, text, text, text,
  text, text, text, text, text, text, text,
  text, text, text
) to anon, authenticated;
