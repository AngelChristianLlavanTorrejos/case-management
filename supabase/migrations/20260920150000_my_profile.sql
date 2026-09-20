insert into public.menus (parent_id, name, icon, path, sort_order, is_active)
select null, 'My Profile', 'CircleUser', '/my-profile', 6, true
where not exists (
  select 1 from public.menus where name = 'My Profile' and parent_id is null
);

insert into public.menus (parent_id, name, icon, path, sort_order, is_active)
select null, 'Change Password', 'KeyRound', '/change-password', 7, true
where not exists (
  select 1 from public.menus where name = 'Change Password' and parent_id is null
);

create or replace function public.get_own_profile(p_actor_user_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  perform public.require_activity_actor(p_actor_user_id);

  select json_build_object(
    'id', u.id,
    'username', u.username,
    'role_name', r.name,
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
  where u.id = p_actor_user_id;

  if v_result is null then
    raise exception 'Profile not found';
  end if;

  return v_result;
end;
$$;

create or replace function public.update_own_profile(
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
  p_email text
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
begin
  perform public.require_activity_actor(p_actor_user_id);

  if exists (
    select 1 from public.contact_information
    where email = p_email and user_id is distinct from p_actor_user_id
  ) then
    raise exception 'Email is already registered';
  end if;

  v_old := public.get_own_profile(p_actor_user_id)::jsonb;
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
  where user_id = p_actor_user_id;

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
  where user_id = p_actor_user_id;

  v_new := public.get_own_profile(p_actor_user_id)::jsonb;

  perform public.write_user_activity_log(
    p_actor_user_id,
    'edit',
    public.menu_id_by_path('/my-profile'),
    format('%s updated their profile.', v_actor_name),
    v_old,
    v_new
  );

  return public.get_own_profile(p_actor_user_id);
end;
$$;

create or replace function public.change_own_password(
  p_actor_user_id bigint,
  p_current_password text,
  p_new_password text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users%rowtype;
  v_actor_name text;
begin
  perform public.require_activity_actor(p_actor_user_id);

  select * into v_user from public.users where id = p_actor_user_id;
  if not found then
    raise exception 'User not found';
  end if;

  if v_user.password is distinct from extensions.crypt(p_current_password, v_user.password) then
    raise exception 'Current password is incorrect.';
  end if;

  if p_new_password is not distinct from p_current_password then
    raise exception 'New password must be different from your current password.';
  end if;

  perform public.assert_password_policy(p_new_password, v_user.username);

  update public.users
  set
    password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
    should_change_password = false,
    failed_login_attempts = 0
  where id = p_actor_user_id;

  v_actor_name := public.user_display_name(p_actor_user_id);

  perform public.write_user_activity_log(
    p_actor_user_id,
    'edit',
    public.menu_id_by_path('/change-password'),
    format('%s changed their password.', v_actor_name),
    jsonb_build_object('should_change_password', v_user.should_change_password),
    jsonb_build_object('should_change_password', false)
  );

  return json_build_object('ok', true, 'id', p_actor_user_id);
end;
$$;

revoke all on function public.get_own_profile(bigint) from public;
revoke all on function public.update_own_profile(
  bigint, text, text, text, bigint, bigint, bigint, date,
  text, text, text, text, text, text, text,
  text, text, text, text, text, text, text,
  text, text, text
) from public;
revoke all on function public.change_own_password(bigint, text, text) from public;

grant execute on function public.get_own_profile(bigint) to anon, authenticated;
grant execute on function public.update_own_profile(
  bigint, text, text, text, bigint, bigint, bigint, date,
  text, text, text, text, text, text, text,
  text, text, text, text, text, text, text,
  text, text, text
) to anon, authenticated;
grant execute on function public.change_own_password(bigint, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
