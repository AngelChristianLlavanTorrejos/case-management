alter table public.users
  add column if not exists position_id bigint references public.positions (id) on delete restrict;

create index if not exists users_position_id_idx on public.users (position_id);

insert into public.menus (parent_id, name, icon, path, sort_order, is_active)
select null, 'Lupon Members', 'UserCog', '/lupon-members', 7, true
where not exists (
  select 1 from public.menus where path = '/lupon-members'
);

update public.menus
set sort_order = case name
  when 'Dashboard' then 1
  when 'Masterfile' then 2
  when 'Filing' then 3
  when 'Notice and Summons' then 4
  when 'Settlement' then 5
  when 'Community Members' then 6
  when 'Lupon Members' then 7
  when 'Utilities' then 8
  when 'My Profile' then 9
  when 'Change Password' then 10
  else sort_order
end
where parent_id is null;

create or replace function public.create_lupon_member(
  p_actor_user_id bigint,
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
  p_username text,
  p_password text
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
  v_status_id bigint;
  v_user_id bigint;
  v_actor_name text;
  v_username text := btrim(coalesce(p_username, ''));
  v_email text := btrim(coalesce(p_email, ''));
begin
  perform public.require_activity_actor(p_actor_user_id);

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

  select id
  into v_role_id
  from public.roles
  where name = v_role_name;

  if v_role_id is null then
    raise exception '% role is not configured', v_role_name;
  end if;

  select id
  into v_status_id
  from public.status
  where lower(name) = 'active';

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
    p_position_id,
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

  v_actor_name := public.user_display_name(p_actor_user_id);

  perform public.write_user_activity_log(
    p_actor_user_id,
    'add',
    public.menu_id_by_path('/lupon-members'),
    format('%s recorded a lupon member (%s).', v_actor_name, v_username),
    null,
    jsonb_build_object(
      'user_id', v_user_id,
      'username', v_username,
      'position_id', p_position_id,
      'role_name', v_role_name
    )
  );

  return json_build_object(
    'id', v_user_id,
    'username', v_username,
    'role_name', v_role_name,
    'position_name', v_position_name
  );
end;
$$;

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
      u.username
    from public.users u
    join public.positions p on p.id = u.position_id
    join public.roles r on r.id = u.role_id
  ),
  filtered as (
    select *
    from base
    where v_search = ''
       or lower(display_name) like '%' || v_search || '%'
       or lower(position_name) like '%' || v_search || '%'
       or lower(role_name) like '%' || v_search || '%'
       or lower(username) like '%' || v_search || '%'
  ),
  counted as (
    select count(*)::integer as total from filtered
  ),
  paged as (
    select id, display_name, position_name, role_name, username
    from filtered
    order by
      case when p_sort_key = 'position_name' and p_sort_dir = 'asc' then position_name end asc,
      case when p_sort_key = 'position_name' and p_sort_dir = 'desc' then position_name end desc,
      case when p_sort_key = 'role_name' and p_sort_dir = 'asc' then role_name end asc,
      case when p_sort_key = 'role_name' and p_sort_dir = 'desc' then role_name end desc,
      case when p_sort_key = 'username' and p_sort_dir = 'asc' then username end asc,
      case when p_sort_key = 'username' and p_sort_dir = 'desc' then username end desc,
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

revoke all on function public.create_lupon_member(
  bigint, bigint,
  text, text, text, bigint, bigint, bigint, date,
  text, text, text, text, text, text, text,
  text, text, text, text, text, text, text,
  text, text, text, text, text
) from public;

revoke all on function public.list_lupon_members(text, text, text, integer, integer) from public;

grant execute on function public.create_lupon_member(
  bigint, bigint,
  text, text, text, bigint, bigint, bigint, date,
  text, text, text, text, text, text, text,
  text, text, text, text, text, text, text,
  text, text, text, text, text
) to anon, authenticated;

grant execute on function public.list_lupon_members(text, text, text, integer, integer) to anon, authenticated;

notify pgrst, 'reload schema';
