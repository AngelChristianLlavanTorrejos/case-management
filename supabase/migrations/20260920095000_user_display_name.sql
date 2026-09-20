create or replace function public.user_display_name(p_user_id bigint)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select
        trim(
          concat_ws(
            ' ',
            pi.first_name,
            case
              when nullif(btrim(pi.middle_name), '') is not null
              then upper(left(btrim(pi.middle_name), 1)) || '.'
            end,
            pi.last_name
          )
        ) || case
          when s.name is not null and lower(s.name) <> 'none' then ' ' || s.name
          else ''
        end
      from public.personal_information pi
      join public.suffixes s on s.id = pi.suffix_id
      where pi.user_id = p_user_id
    ),
    (select username from public.users where id = p_user_id)
  );
$$;

revoke all on function public.user_display_name(bigint) from public;

create or replace function public.get_user_profile(p_user_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role_name text;
begin
  select r.name into v_role_name
  from public.users u
  join public.roles r on r.id = u.role_id
  where u.id = p_user_id;

  if v_role_name is null then
    raise exception 'User not found';
  end if;

  return json_build_object(
    'id', p_user_id,
    'display_name', public.user_display_name(p_user_id),
    'role_name', v_role_name
  );
end;
$$;

revoke all on function public.get_user_profile(bigint) from public;
grant execute on function public.get_user_profile(bigint) to anon, authenticated;

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

  select name into v_role_name from public.roles where id = v_user.role_id;
  select name into v_status_name from public.status where id = v_user.status_id;

  return json_build_object(
    'id', v_user.id,
    'username', v_user.username,
    'role_name', v_role_name,
    'status_name', v_status_name,
    'display_name', public.user_display_name(v_user.id)
  );
end;
$$;

create or replace function public.register_user(
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
  v_role_id bigint;
  v_status_id bigint;
  v_user_id bigint;
  v_role_name text;
  v_status_name text;
begin
  select id, name into v_role_id, v_role_name
  from public.roles
  where name = 'User';

  if v_role_id is null then
    raise exception 'User role is not configured';
  end if;

  select id, name into v_status_id, v_status_name
  from public.status
  where lower(name) = 'for registration';

  if v_status_id is null then
    raise exception 'For Registration status is not configured';
  end if;

  if exists (select 1 from public.users where username = p_username) then
    raise exception 'Username is already taken';
  end if;

  if exists (select 1 from public.contact_information where email = p_email) then
    raise exception 'Email is already registered';
  end if;

  insert into public.users (
    role_id,
    username,
    password,
    status_id,
    should_change_password
  )
  values (
    v_role_id,
    p_username,
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
    p_email
  );

  return json_build_object(
    'id', v_user_id,
    'username', p_username,
    'role_name', v_role_name,
    'status_name', v_status_name,
    'display_name', public.user_display_name(v_user_id)
  );
end;
$$;
