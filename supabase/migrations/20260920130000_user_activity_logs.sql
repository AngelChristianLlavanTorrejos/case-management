create table public.user_activity_logs (
  id bigint generated always as identity primary key,
  user_id bigint references public.users (id) on delete set null,
  old_value jsonb,
  new_value jsonb,
  activity text not null,
  menu_id bigint references public.menus (id) on delete set null,
  details text not null,
  created_at timestamptz not null default now(),
  constraint user_activity_logs_activity_check
    check (activity in ('add', 'edit', 'delete', 'approve', 'restrict', 'login_failed'))
);

create index user_activity_logs_created_at_idx on public.user_activity_logs (created_at desc);
create index user_activity_logs_user_id_idx on public.user_activity_logs (user_id);
create index user_activity_logs_menu_id_idx on public.user_activity_logs (menu_id);

alter table public.user_activity_logs enable row level security;
revoke all on table public.user_activity_logs from public, anon, authenticated;

create or replace function public.write_user_activity_log(
  p_user_id bigint,
  p_activity text,
  p_menu_id bigint,
  p_details text,
  p_old_value jsonb default null,
  p_new_value jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_activity not in ('add', 'edit', 'delete', 'approve', 'restrict', 'login_failed') then
    raise exception 'Invalid activity';
  end if;

  if p_details is null or char_length(btrim(p_details)) = 0 then
    raise exception 'Details are required';
  end if;

  if p_user_id is not null and not exists (select 1 from public.users where id = p_user_id) then
    raise exception 'Actor not found';
  end if;

  insert into public.user_activity_logs (
    user_id,
    old_value,
    new_value,
    activity,
    menu_id,
    details
  )
  values (
    p_user_id,
    p_old_value,
    p_new_value,
    p_activity,
    p_menu_id,
    btrim(p_details)
  );
end;
$$;

revoke all on function public.write_user_activity_log(bigint, text, bigint, text, jsonb, jsonb) from public;

create or replace function public.require_activity_actor(p_actor_user_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_actor_user_id is null or not exists (select 1 from public.users where id = p_actor_user_id) then
    raise exception 'Actor not found';
  end if;
end;
$$;

revoke all on function public.require_activity_actor(bigint) from public;

create or replace function public.menu_id_by_path(p_path text)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.menus
  where path = p_path
  order by id
  limit 1;
$$;

revoke all on function public.menu_id_by_path(text) from public;

create or replace function public.list_user_activity_logs(
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
      l.id,
      coalesce(nullif(public.user_display_name(l.user_id), ''), 'Deleted user') as user_name,
      l.activity,
      coalesce(m.name, '—') as menu_name,
      l.details,
      l.created_at
    from public.user_activity_logs l
    left join public.menus m on m.id = l.menu_id
  ),
  filtered as (
    select *
    from base
    where v_search = ''
       or lower(user_name) like '%' || v_search || '%'
       or lower(details) like '%' || v_search || '%'
       or lower(activity) like '%' || v_search || '%'
       or lower(menu_name) like '%' || v_search || '%'
  ),
  counted as (
    select count(*)::integer as total from filtered
  ),
  paged as (
    select id, user_name, activity, menu_name, created_at
    from filtered
    order by
      case when p_sort_key = 'user_name' and p_sort_dir = 'asc' then user_name end asc,
      case when p_sort_key = 'user_name' and p_sort_dir = 'desc' then user_name end desc,
      case when p_sort_key = 'activity' and p_sort_dir = 'asc' then activity end asc,
      case when p_sort_key = 'activity' and p_sort_dir = 'desc' then activity end desc,
      case when p_sort_key = 'menu_name' and p_sort_dir = 'asc' then menu_name end asc,
      case when p_sort_key = 'menu_name' and p_sort_dir = 'desc' then menu_name end desc,
      case when p_sort_key = 'created_at' and p_sort_dir = 'asc' then created_at end asc,
      case when p_sort_key is distinct from 'created_at' or p_sort_dir is distinct from 'asc'
        then created_at
      end desc,
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

create or replace function public.get_user_activity_log(p_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  select json_build_object(
    'id', l.id,
    'user_name', coalesce(nullif(public.user_display_name(l.user_id), ''), 'Deleted user'),
    'activity', l.activity,
    'menu_name', coalesce(m.name, '—'),
    'details', l.details,
    'created_at', l.created_at
  )
  into v_result
  from public.user_activity_logs l
  left join public.menus m on m.id = l.menu_id
  where l.id = p_id;

  if v_result is null then
    raise exception 'Activity log not found';
  end if;

  return v_result;
end;
$$;

revoke all on function public.list_user_activity_logs(text, text, text, integer, integer) from public;
revoke all on function public.get_user_activity_log(bigint) from public;
grant execute on function public.list_user_activity_logs(text, text, text, integer, integer) to anon, authenticated;
grant execute on function public.get_user_activity_log(bigint) to anon, authenticated;

insert into public.menus (parent_id, name, icon, path, sort_order, is_active)
select null, 'User Activity Log', 'ScrollText', '/user-activity-log', 4, true
where not exists (
  select 1 from public.menus where name = 'User Activity Log' and parent_id is null
);

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

  if not found then
    return json_build_object('error', 'Invalid username or password');
  end if;

  if v_user.password is distinct from extensions.crypt(p_password, v_user.password) then
    perform public.write_user_activity_log(
      v_user.id,
      'login_failed',
      null,
      format('Login failed for username %s.', v_user.username),
      null,
      null
    );
    return json_build_object('error', 'Invalid username or password');
  end if;

  select name into v_status_name from public.status where id = v_user.status_id;

  if lower(v_status_name) = 'for registration' then
    perform public.write_user_activity_log(
      v_user.id,
      'login_failed',
      null,
      format('Login failed for username %s.', v_user.username),
      null,
      null
    );
    return json_build_object('error', 'Your account is waiting for approval.');
  end if;

  if lower(v_status_name) = 'inactive' then
    perform public.write_user_activity_log(
      v_user.id,
      'login_failed',
      null,
      format('Login failed for username %s.', v_user.username),
      null,
      null
    );
    return json_build_object('error', 'Your account is inactive.');
  end if;

  if lower(coalesce(v_status_name, '')) is distinct from 'active' then
    perform public.write_user_activity_log(
      v_user.id,
      'login_failed',
      null,
      format('Login failed for username %s.', v_user.username),
      null,
      null
    );
    return json_build_object('error', 'Your account cannot sign in.');
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
  v_display_name text;
  v_snapshot jsonb;
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

  v_display_name := public.user_display_name(v_user_id);
  v_snapshot := public.get_community_member(v_user_id)::jsonb;

  perform public.write_user_activity_log(
    v_user_id,
    'add',
    null,
    format('%s created an account.', v_display_name),
    null,
    v_snapshot
  );

  return json_build_object(
    'id', v_user_id,
    'username', p_username,
    'role_name', v_role_name,
    'status_name', v_status_name,
    'display_name', v_display_name
  );
end;
$$;

drop function if exists public.approve_community_member(bigint);
drop function if exists public.disapprove_community_member(bigint);
drop function if exists public.restrict_community_member(bigint);
drop function if exists public.delete_community_member(bigint);
drop function if exists public.update_community_member(
  bigint, text, text, text, bigint, bigint, bigint, date,
  text, text, text, text, text, text, text,
  text, text, text, text, text, text, text,
  text, text, text
);
drop function if exists public.create_suffix(text);
drop function if exists public.update_suffix(bigint, text);
drop function if exists public.delete_suffix(bigint);
drop function if exists public.create_civil_status(text);
drop function if exists public.update_civil_status(bigint, text);
drop function if exists public.delete_civil_status(bigint);

create or replace function public.approve_community_member(p_id bigint, p_actor_user_id bigint)
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
      and r.name = 'User'
      and lower(s.name) = 'for registration'
  ) then
    raise exception 'Registration request not found';
  end if;

  select id into v_status_id from public.status where lower(name) = 'active';
  if v_status_id is null then
    raise exception 'Active status is not configured';
  end if;

  v_old := public.get_community_member(p_id)::jsonb;
  v_member_name := public.user_display_name(p_id);
  v_actor_name := public.user_display_name(p_actor_user_id);

  update public.users
  set status_id = v_status_id
  where id = p_id;

  v_new := public.get_community_member(p_id)::jsonb;

  perform public.write_user_activity_log(
    p_actor_user_id,
    'approve',
    public.menu_id_by_path('/community-members'),
    format('%s approved %s.', v_actor_name, v_member_name),
    v_old,
    v_new
  );

  return json_build_object('ok', true, 'id', p_id);
end;
$$;

create or replace function public.disapprove_community_member(p_id bigint, p_actor_user_id bigint)
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

  v_old := public.get_community_member(p_id)::jsonb;
  v_member_name := public.user_display_name(p_id);
  v_actor_name := public.user_display_name(p_actor_user_id);

  delete from public.users where id = p_id;

  perform public.write_user_activity_log(
    p_actor_user_id,
    'delete',
    public.menu_id_by_path('/community-members'),
    format('%s disapproved %s.', v_actor_name, v_member_name),
    v_old,
    null
  );

  return json_build_object('ok', true, 'id', p_id);
end;
$$;

create or replace function public.restrict_community_member(p_id bigint, p_actor_user_id bigint)
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
      and r.name = 'User'
      and lower(s.name) = 'active'
  ) then
    raise exception 'Active resident not found';
  end if;

  select id into v_status_id from public.status where lower(name) = 'inactive';
  if v_status_id is null then
    raise exception 'Inactive status is not configured';
  end if;

  v_old := public.get_community_member(p_id)::jsonb;
  v_member_name := public.user_display_name(p_id);
  v_actor_name := public.user_display_name(p_actor_user_id);

  update public.users
  set status_id = v_status_id
  where id = p_id;

  v_new := public.get_community_member(p_id)::jsonb;

  perform public.write_user_activity_log(
    p_actor_user_id,
    'restrict',
    public.menu_id_by_path('/community-members'),
    format('%s restricted %s.', v_actor_name, v_member_name),
    v_old,
    v_new
  );

  return json_build_object('ok', true, 'id', p_id);
end;
$$;

create or replace function public.delete_community_member(p_id bigint, p_actor_user_id bigint)
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

  v_old := public.get_community_member(p_id)::jsonb;
  v_member_name := public.user_display_name(p_id);
  v_actor_name := public.user_display_name(p_actor_user_id);

  delete from public.users where id = p_id;

  perform public.write_user_activity_log(
    p_actor_user_id,
    'delete',
    public.menu_id_by_path('/community-members'),
    format('%s deleted %s.', v_actor_name, v_member_name),
    v_old,
    null
  );

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

  v_old := public.get_community_member(p_id)::jsonb;
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

  v_new := public.get_community_member(p_id)::jsonb;

  perform public.write_user_activity_log(
    p_actor_user_id,
    'edit',
    public.menu_id_by_path('/community-members'),
    format('%s updated %s.', v_actor_name, v_member_name),
    v_old,
    v_new
  );

  return public.get_community_member(p_id);
end;
$$;

create or replace function public.create_suffix(p_name text, p_actor_user_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(p_name);
  v_row public.suffixes%rowtype;
  v_actor_name text;
begin
  perform public.require_activity_actor(p_actor_user_id);

  if v_name is null or char_length(v_name) = 0 then
    raise exception 'Name is required';
  end if;

  if exists (select 1 from public.suffixes where lower(name) = lower(v_name)) then
    raise exception 'Suffix "%" already exists', v_name;
  end if;

  insert into public.suffixes (name)
  values (v_name)
  returning * into v_row;

  v_actor_name := public.user_display_name(p_actor_user_id);

  perform public.write_user_activity_log(
    p_actor_user_id,
    'add',
    public.menu_id_by_path('/masterfile/suffixes'),
    format('%s added suffix "%s".', v_actor_name, v_row.name),
    null,
    to_jsonb(v_row)
  );

  return to_json(v_row);
end;
$$;

create or replace function public.update_suffix(p_id bigint, p_name text, p_actor_user_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(p_name);
  v_old public.suffixes%rowtype;
  v_row public.suffixes%rowtype;
  v_actor_name text;
begin
  perform public.require_activity_actor(p_actor_user_id);

  if v_name is null or char_length(v_name) = 0 then
    raise exception 'Name is required';
  end if;

  select * into v_old from public.suffixes where id = p_id;
  if not found then
    raise exception 'Suffix not found';
  end if;

  if v_old.can_delete is false then
    raise exception 'System value "%" cannot be edited', v_old.name;
  end if;

  if exists (
    select 1 from public.suffixes
    where lower(name) = lower(v_name) and id is distinct from p_id
  ) then
    raise exception 'Suffix "%" already exists', v_name;
  end if;

  update public.suffixes
  set name = v_name
  where id = p_id
  returning * into v_row;

  v_actor_name := public.user_display_name(p_actor_user_id);

  perform public.write_user_activity_log(
    p_actor_user_id,
    'edit',
    public.menu_id_by_path('/masterfile/suffixes'),
    format('%s changed suffix "%s" to "%s".', v_actor_name, v_old.name, v_row.name),
    to_jsonb(v_old),
    to_jsonb(v_row)
  );

  return to_json(v_row);
end;
$$;

create or replace function public.delete_suffix(p_id bigint, p_actor_user_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.suffixes%rowtype;
  v_actor_name text;
begin
  perform public.require_activity_actor(p_actor_user_id);

  select * into v_row from public.suffixes where id = p_id;
  if not found then
    raise exception 'Suffix not found';
  end if;

  begin
    delete from public.suffixes where id = p_id;
  exception
    when foreign_key_violation then
      raise exception 'Suffix "%" is in use and cannot be deleted', v_row.name;
  end;

  v_actor_name := public.user_display_name(p_actor_user_id);

  perform public.write_user_activity_log(
    p_actor_user_id,
    'delete',
    public.menu_id_by_path('/masterfile/suffixes'),
    format('%s deleted suffix "%s".', v_actor_name, v_row.name),
    to_jsonb(v_row),
    null
  );

  return json_build_object('ok', true, 'id', p_id);
end;
$$;

create or replace function public.create_civil_status(p_name text, p_actor_user_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(p_name);
  v_row public.civil_status%rowtype;
  v_actor_name text;
begin
  perform public.require_activity_actor(p_actor_user_id);

  if v_name is null or char_length(v_name) = 0 then
    raise exception 'Name is required';
  end if;

  if exists (select 1 from public.civil_status where lower(name) = lower(v_name)) then
    raise exception 'Civil status "%" already exists', v_name;
  end if;

  insert into public.civil_status (name)
  values (v_name)
  returning * into v_row;

  v_actor_name := public.user_display_name(p_actor_user_id);

  perform public.write_user_activity_log(
    p_actor_user_id,
    'add',
    public.menu_id_by_path('/masterfile/civil-status'),
    format('%s added civil status "%s".', v_actor_name, v_row.name),
    null,
    to_jsonb(v_row)
  );

  return to_json(v_row);
end;
$$;

create or replace function public.update_civil_status(p_id bigint, p_name text, p_actor_user_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(p_name);
  v_old public.civil_status%rowtype;
  v_row public.civil_status%rowtype;
  v_actor_name text;
begin
  perform public.require_activity_actor(p_actor_user_id);

  if v_name is null or char_length(v_name) = 0 then
    raise exception 'Name is required';
  end if;

  select * into v_old from public.civil_status where id = p_id;
  if not found then
    raise exception 'Civil status not found';
  end if;

  if v_old.can_delete is false then
    raise exception 'System value "%" cannot be edited', v_old.name;
  end if;

  if exists (
    select 1 from public.civil_status
    where lower(name) = lower(v_name) and id is distinct from p_id
  ) then
    raise exception 'Civil status "%" already exists', v_name;
  end if;

  update public.civil_status
  set name = v_name
  where id = p_id
  returning * into v_row;

  v_actor_name := public.user_display_name(p_actor_user_id);

  perform public.write_user_activity_log(
    p_actor_user_id,
    'edit',
    public.menu_id_by_path('/masterfile/civil-status'),
    format('%s changed civil status "%s" to "%s".', v_actor_name, v_old.name, v_row.name),
    to_jsonb(v_old),
    to_jsonb(v_row)
  );

  return to_json(v_row);
end;
$$;

create or replace function public.delete_civil_status(p_id bigint, p_actor_user_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.civil_status%rowtype;
  v_actor_name text;
begin
  perform public.require_activity_actor(p_actor_user_id);

  select * into v_row from public.civil_status where id = p_id;
  if not found then
    raise exception 'Civil status not found';
  end if;

  begin
    delete from public.civil_status where id = p_id;
  exception
    when foreign_key_violation then
      raise exception 'Civil status "%" is in use and cannot be deleted', v_row.name;
  end;

  v_actor_name := public.user_display_name(p_actor_user_id);

  perform public.write_user_activity_log(
    p_actor_user_id,
    'delete',
    public.menu_id_by_path('/masterfile/civil-status'),
    format('%s deleted civil status "%s".', v_actor_name, v_row.name),
    to_jsonb(v_row),
    null
  );

  return json_build_object('ok', true, 'id', p_id);
end;
$$;

revoke all on function public.login_user(text, text) from public;
grant execute on function public.login_user(text, text) to anon, authenticated;

revoke all on function public.approve_community_member(bigint, bigint) from public;
revoke all on function public.disapprove_community_member(bigint, bigint) from public;
revoke all on function public.restrict_community_member(bigint, bigint) from public;
revoke all on function public.delete_community_member(bigint, bigint) from public;
revoke all on function public.update_community_member(
  bigint, text, text, text, bigint, bigint, bigint, date,
  text, text, text, text, text, text, text,
  text, text, text, text, text, text, text,
  text, text, text, bigint
) from public;
revoke all on function public.create_suffix(text, bigint) from public;
revoke all on function public.update_suffix(bigint, text, bigint) from public;
revoke all on function public.delete_suffix(bigint, bigint) from public;
revoke all on function public.create_civil_status(text, bigint) from public;
revoke all on function public.update_civil_status(bigint, text, bigint) from public;
revoke all on function public.delete_civil_status(bigint, bigint) from public;

grant execute on function public.approve_community_member(bigint, bigint) to anon, authenticated;
grant execute on function public.disapprove_community_member(bigint, bigint) to anon, authenticated;
grant execute on function public.restrict_community_member(bigint, bigint) to anon, authenticated;
grant execute on function public.delete_community_member(bigint, bigint) to anon, authenticated;
grant execute on function public.update_community_member(
  bigint, text, text, text, bigint, bigint, bigint, date,
  text, text, text, text, text, text, text,
  text, text, text, text, text, text, text,
  text, text, text, bigint
) to anon, authenticated;
grant execute on function public.create_suffix(text, bigint) to anon, authenticated;
grant execute on function public.update_suffix(bigint, text, bigint) to anon, authenticated;
grant execute on function public.delete_suffix(bigint, bigint) to anon, authenticated;
grant execute on function public.create_civil_status(text, bigint) to anon, authenticated;
grant execute on function public.update_civil_status(bigint, text, bigint) to anon, authenticated;
grant execute on function public.delete_civil_status(bigint, bigint) to anon, authenticated;

notify pgrst, 'reload schema';
