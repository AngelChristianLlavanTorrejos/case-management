alter table public.users
  add column if not exists failed_login_attempts integer not null default 0,
  add column if not exists last_login_at timestamptz,
  add column if not exists active_session_token uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'users_failed_login_attempts_non_negative'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_failed_login_attempts_non_negative
      check (failed_login_attempts >= 0);
  end if;
end $$;

create table public.security_settings (
  id smallint primary key default 1,
  is_locked_after_a_certain_login_attempts boolean not null default false,
  allow_login_attempts integer not null default 0,
  is_logout_after_a_certain_idle_minutes boolean not null default false,
  max_idle_minutes integer not null default 0,
  is_restrict_user_after_a_certain_inactive_days boolean not null default false,
  max_inactive_days integer not null default 0,
  is_allow_dual_login boolean not null default false,
  is_enable_min_length_password boolean not null default false,
  min_length_password integer not null default 0,
  is_enable_max_length_password boolean not null default false,
  max_length_password integer not null default 0,
  is_enable_min_lowercase boolean not null default false,
  min_lowercase integer not null default 0,
  is_enable_min_uppercase boolean not null default false,
  min_uppercase integer not null default 0,
  is_enable_min_numeric boolean not null default false,
  min_numeric integer not null default 0,
  is_enable_min_special_character boolean not null default false,
  min_special_character integer not null default 0,
  is_enable_password_must_not_match_username boolean not null default false,
  is_enable_password_must_not_contain_sequential boolean not null default false,
  is_enable_password_must_not_contain_repeated_char boolean not null default false,
  constraint security_settings_singleton check (id = 1),
  constraint security_settings_allow_login_attempts_non_negative check (allow_login_attempts >= 0),
  constraint security_settings_max_idle_minutes_non_negative check (max_idle_minutes >= 0),
  constraint security_settings_max_inactive_days_non_negative check (max_inactive_days >= 0),
  constraint security_settings_min_length_password_non_negative check (min_length_password >= 0),
  constraint security_settings_max_length_password_non_negative check (max_length_password >= 0),
  constraint security_settings_min_lowercase_non_negative check (min_lowercase >= 0),
  constraint security_settings_min_uppercase_non_negative check (min_uppercase >= 0),
  constraint security_settings_min_numeric_non_negative check (min_numeric >= 0),
  constraint security_settings_min_special_character_non_negative check (min_special_character >= 0)
);

insert into public.security_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.security_settings enable row level security;
revoke all on table public.security_settings from public, anon, authenticated;

insert into public.menus (parent_id, name, icon, path, sort_order, is_active)
select null, 'Baseline Security', 'ShieldCheck', '/baseline-security', 5, true
where not exists (
  select 1 from public.menus where name = 'Baseline Security' and parent_id is null
);

create or replace function public.require_enabled_amount(p_enabled boolean, p_value integer)
returns void
language plpgsql
immutable
as $$
begin
  if p_enabled and coalesce(p_value, 0) < 1 then
    raise exception 'Enter a value of at least 1.';
  end if;
end;
$$;

revoke all on function public.require_enabled_amount(boolean, integer) from public;

create or replace function public.password_count_phrase(p_count integer, p_singular text, p_plural text)
returns text
language sql
immutable
as $$
  select format('%s %s', p_count, case when p_count = 1 then p_singular else p_plural end);
$$;

revoke all on function public.password_count_phrase(integer, text, text) from public;

create or replace function public.password_has_sequential(p_password text)
returns boolean
language plpgsql
immutable
as $$
declare
  v_text text := coalesce(p_password, '');
  v_lower text;
  v_i integer;
  v_a integer;
  v_b integer;
  v_c integer;
begin
  if char_length(v_text) < 3 then
    return false;
  end if;

  for v_i in 1 .. char_length(v_text) - 2 loop
    v_a := ascii(substr(v_text, v_i, 1));
    v_b := ascii(substr(v_text, v_i + 1, 1));
    v_c := ascii(substr(v_text, v_i + 2, 1));
    if (v_b - v_a = 1 and v_c - v_b = 1) or (v_a - v_b = 1 and v_b - v_c = 1) then
      return true;
    end if;
  end loop;

  v_lower := lower(v_text);
  if v_lower is distinct from v_text then
    for v_i in 1 .. char_length(v_lower) - 2 loop
      v_a := ascii(substr(v_lower, v_i, 1));
      v_b := ascii(substr(v_lower, v_i + 1, 1));
      v_c := ascii(substr(v_lower, v_i + 2, 1));
      if (v_b - v_a = 1 and v_c - v_b = 1) or (v_a - v_b = 1 and v_b - v_c = 1) then
        return true;
      end if;
    end loop;
  end if;

  return false;
end;
$$;

revoke all on function public.password_has_sequential(text) from public;

create or replace function public.assert_password_policy(p_password text, p_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.security_settings%rowtype;
  v_password text := coalesce(p_password, '');
  v_username text := coalesce(p_username, '');
  v_lower integer;
  v_upper integer;
  v_numeric integer;
  v_special integer;
begin
  select * into v_settings from public.security_settings where id = 1;
  if not found then
    return;
  end if;

  if v_settings.is_enable_min_length_password
     and char_length(v_password) < v_settings.min_length_password then
    raise exception 'Password must be at least % characters.', v_settings.min_length_password;
  end if;

  if v_settings.is_enable_max_length_password
     and char_length(v_password) > v_settings.max_length_password then
    raise exception 'Password must be % characters or fewer.', v_settings.max_length_password;
  end if;

  v_lower := char_length(regexp_replace(v_password, '[^a-z]', '', 'g'));
  v_upper := char_length(regexp_replace(v_password, '[^A-Z]', '', 'g'));
  v_numeric := char_length(regexp_replace(v_password, '[^0-9]', '', 'g'));
  v_special := char_length(regexp_replace(v_password, '[a-zA-Z0-9]', '', 'g'));

  if v_settings.is_enable_min_lowercase and v_lower < v_settings.min_lowercase then
    raise exception 'Password must include at least %.',
      public.password_count_phrase(v_settings.min_lowercase, 'lowercase letter', 'lowercase letters');
  end if;

  if v_settings.is_enable_min_uppercase and v_upper < v_settings.min_uppercase then
    raise exception 'Password must include at least %.',
      public.password_count_phrase(v_settings.min_uppercase, 'uppercase letter', 'uppercase letters');
  end if;

  if v_settings.is_enable_min_numeric and v_numeric < v_settings.min_numeric then
    raise exception 'Password must include at least %.',
      public.password_count_phrase(v_settings.min_numeric, 'number', 'numbers');
  end if;

  if v_settings.is_enable_min_special_character and v_special < v_settings.min_special_character then
    raise exception 'Password must include at least %.',
      public.password_count_phrase(v_settings.min_special_character, 'special character', 'special characters');
  end if;

  if v_settings.is_enable_password_must_not_match_username
     and v_username <> ''
     and strpos(lower(v_password), lower(v_username)) > 0 then
    raise exception 'Password must not contain your username.';
  end if;

  if v_settings.is_enable_password_must_not_contain_sequential
     and public.password_has_sequential(v_password) then
    raise exception 'Password must not contain sequential characters such as abc or 123.';
  end if;

  if v_settings.is_enable_password_must_not_contain_repeated_char
     and v_password ~ '(.)\1{2}' then
    raise exception 'Password must not repeat the same character 3 times in a row.';
  end if;
end;
$$;

revoke all on function public.assert_password_policy(text, text) from public;

create or replace function public.get_security_settings()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  select to_json(s) into v_result
  from public.security_settings s
  where s.id = 1;

  if v_result is null then
    raise exception 'Security settings are not configured';
  end if;

  return v_result;
end;
$$;

create or replace function public.update_security_settings(
  p_is_locked_after_a_certain_login_attempts boolean,
  p_allow_login_attempts integer,
  p_is_logout_after_a_certain_idle_minutes boolean,
  p_max_idle_minutes integer,
  p_is_restrict_user_after_a_certain_inactive_days boolean,
  p_max_inactive_days integer,
  p_is_allow_dual_login boolean,
  p_is_enable_min_length_password boolean,
  p_min_length_password integer,
  p_is_enable_max_length_password boolean,
  p_max_length_password integer,
  p_is_enable_min_lowercase boolean,
  p_min_lowercase integer,
  p_is_enable_min_uppercase boolean,
  p_min_uppercase integer,
  p_is_enable_min_numeric boolean,
  p_min_numeric integer,
  p_is_enable_min_special_character boolean,
  p_min_special_character integer,
  p_is_enable_password_must_not_match_username boolean,
  p_is_enable_password_must_not_contain_sequential boolean,
  p_is_enable_password_must_not_contain_repeated_char boolean,
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
begin
  perform public.require_activity_actor(p_actor_user_id);
  perform public.require_enabled_amount(p_is_locked_after_a_certain_login_attempts, p_allow_login_attempts);
  perform public.require_enabled_amount(p_is_logout_after_a_certain_idle_minutes, p_max_idle_minutes);
  perform public.require_enabled_amount(p_is_restrict_user_after_a_certain_inactive_days, p_max_inactive_days);
  perform public.require_enabled_amount(p_is_enable_min_length_password, p_min_length_password);
  perform public.require_enabled_amount(p_is_enable_max_length_password, p_max_length_password);
  perform public.require_enabled_amount(p_is_enable_min_lowercase, p_min_lowercase);
  perform public.require_enabled_amount(p_is_enable_min_uppercase, p_min_uppercase);
  perform public.require_enabled_amount(p_is_enable_min_numeric, p_min_numeric);
  perform public.require_enabled_amount(p_is_enable_min_special_character, p_min_special_character);

  if p_is_enable_min_length_password
     and p_is_enable_max_length_password
     and p_min_length_password > p_max_length_password then
    raise exception 'Minimum password length cannot be greater than maximum password length.';
  end if;

  select to_jsonb(s) into v_old from public.security_settings s where s.id = 1;
  if v_old is null then
    raise exception 'Security settings are not configured';
  end if;

  update public.security_settings
  set
    is_locked_after_a_certain_login_attempts = coalesce(p_is_locked_after_a_certain_login_attempts, false),
    allow_login_attempts = coalesce(p_allow_login_attempts, 0),
    is_logout_after_a_certain_idle_minutes = coalesce(p_is_logout_after_a_certain_idle_minutes, false),
    max_idle_minutes = coalesce(p_max_idle_minutes, 0),
    is_restrict_user_after_a_certain_inactive_days = coalesce(p_is_restrict_user_after_a_certain_inactive_days, false),
    max_inactive_days = coalesce(p_max_inactive_days, 0),
    is_allow_dual_login = coalesce(p_is_allow_dual_login, false),
    is_enable_min_length_password = coalesce(p_is_enable_min_length_password, false),
    min_length_password = coalesce(p_min_length_password, 0),
    is_enable_max_length_password = coalesce(p_is_enable_max_length_password, false),
    max_length_password = coalesce(p_max_length_password, 0),
    is_enable_min_lowercase = coalesce(p_is_enable_min_lowercase, false),
    min_lowercase = coalesce(p_min_lowercase, 0),
    is_enable_min_uppercase = coalesce(p_is_enable_min_uppercase, false),
    min_uppercase = coalesce(p_min_uppercase, 0),
    is_enable_min_numeric = coalesce(p_is_enable_min_numeric, false),
    min_numeric = coalesce(p_min_numeric, 0),
    is_enable_min_special_character = coalesce(p_is_enable_min_special_character, false),
    min_special_character = coalesce(p_min_special_character, 0),
    is_enable_password_must_not_match_username = coalesce(p_is_enable_password_must_not_match_username, false),
    is_enable_password_must_not_contain_sequential = coalesce(p_is_enable_password_must_not_contain_sequential, false),
    is_enable_password_must_not_contain_repeated_char = coalesce(p_is_enable_password_must_not_contain_repeated_char, false)
  where id = 1;

  select to_jsonb(s) into v_new from public.security_settings s where s.id = 1;
  v_actor_name := public.user_display_name(p_actor_user_id);

  perform public.write_user_activity_log(
    p_actor_user_id,
    'edit',
    public.menu_id_by_path('/baseline-security'),
    format('%s updated Baseline Security settings.', v_actor_name),
    v_old,
    v_new
  );

  return public.get_security_settings();
end;
$$;

create or replace function public.validate_session(p_user_id bigint, p_session_token uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users%rowtype;
  v_status_name text;
  v_allow_dual boolean;
begin
  select * into v_user from public.users where id = p_user_id;
  if not found then
    return json_build_object('valid', false);
  end if;

  select name into v_status_name from public.status where id = v_user.status_id;
  if lower(coalesce(v_status_name, '')) is distinct from 'active' then
    return json_build_object('valid', false);
  end if;

  select is_allow_dual_login into v_allow_dual
  from public.security_settings
  where id = 1;

  if coalesce(v_allow_dual, true) then
    return json_build_object('valid', true);
  end if;

  if v_user.active_session_token is null or p_session_token is null then
    return json_build_object('valid', true);
  end if;

  return json_build_object('valid', v_user.active_session_token = p_session_token);
end;
$$;

create or replace function public.logout_user(p_user_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
begin
  select username into v_username
  from public.users
  where id = p_user_id;

  if v_username is null then
    raise exception 'User not found';
  end if;

  update public.users
  set active_session_token = null
  where id = p_user_id;

  return json_build_object(
    'ok', true,
    'id', p_user_id,
    'username', v_username
  );
end;
$$;

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
  v_settings public.security_settings%rowtype;
  v_inactive_id bigint;
  v_token uuid;
  v_remaining integer;
  v_actor_name text;
begin
  select * into v_settings from public.security_settings where id = 1;

  select * into v_user
  from public.users
  where username = p_username;

  if not found then
    return json_build_object('error', 'Invalid username or password');
  end if;

  select name into v_status_name from public.status where id = v_user.status_id;
  v_actor_name := public.user_display_name(v_user.id);
  select id into v_inactive_id from public.status where lower(name) = 'inactive';

  if v_user.password is distinct from extensions.crypt(p_password, v_user.password) then
    perform public.write_user_activity_log(
      v_user.id,
      'login_failed',
      null,
      format('Login failed for username %s.', v_user.username),
      null,
      null
    );

    if coalesce(v_settings.is_locked_after_a_certain_login_attempts, false)
       and coalesce(v_settings.allow_login_attempts, 0) >= 1 then
      update public.users
      set failed_login_attempts = failed_login_attempts + 1
      where id = v_user.id
      returning failed_login_attempts into v_remaining;

      if v_remaining >= v_settings.allow_login_attempts then
        if v_inactive_id is not null and lower(coalesce(v_status_name, '')) is distinct from 'inactive' then
          update public.users
          set status_id = v_inactive_id
          where id = v_user.id;

          perform public.write_user_activity_log(
            v_user.id,
            'restrict',
            public.menu_id_by_path('/community-members'),
            format(
              '%s was locked after %s failed login attempts.',
              v_actor_name,
              v_settings.allow_login_attempts
            ),
            jsonb_build_object('status_name', v_status_name, 'failed_login_attempts', v_remaining - 1),
            jsonb_build_object('status_name', 'inactive', 'failed_login_attempts', v_remaining)
          );
        end if;

        return json_build_object(
          'error',
          format(
            'Your account is locked after %s failed login attempts. Contact an administrator.',
            v_settings.allow_login_attempts
          )
        );
      end if;

      return json_build_object(
        'error',
        format(
          'Invalid username or password. %s attempt(s) remaining.',
          v_settings.allow_login_attempts - v_remaining
        )
      );
    end if;

    return json_build_object('error', 'Invalid username or password');
  end if;

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

  if coalesce(v_settings.is_restrict_user_after_a_certain_inactive_days, false)
     and coalesce(v_settings.max_inactive_days, 0) >= 1
     and v_user.last_login_at is not null
     and v_user.last_login_at < (now() - make_interval(days => v_settings.max_inactive_days)) then
    if v_inactive_id is not null then
      update public.users
      set status_id = v_inactive_id
      where id = v_user.id;
    end if;

    perform public.write_user_activity_log(
      v_user.id,
      'restrict',
      public.menu_id_by_path('/community-members'),
      format(
        '%s was restricted after %s days without signing in.',
        v_actor_name,
        v_settings.max_inactive_days
      ),
      jsonb_build_object('status_name', v_status_name, 'last_login_at', v_user.last_login_at),
      jsonb_build_object('status_name', 'inactive', 'last_login_at', v_user.last_login_at)
    );

    return json_build_object(
      'error',
      format(
        'Your account was restricted after %s days without signing in. Contact an administrator.',
        v_settings.max_inactive_days
      )
    );
  end if;

  v_token := gen_random_uuid();

  update public.users
  set
    failed_login_attempts = 0,
    last_login_at = now(),
    active_session_token = v_token
  where id = v_user.id;

  select name into v_role_name from public.roles where id = v_user.role_id;

  return json_build_object(
    'id', v_user.id,
    'username', v_user.username,
    'role_name', v_role_name,
    'status_name', v_status_name,
    'display_name', public.user_display_name(v_user.id),
    'session_token', v_token
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
  perform public.assert_password_policy(p_password, p_username);

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

create or replace function public.allow_community_member(p_id bigint, p_actor_user_id bigint)
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
      and lower(s.name) = 'inactive'
  ) then
    raise exception 'Inactive resident not found';
  end if;

  select id into v_status_id from public.status where lower(name) = 'active';
  if v_status_id is null then
    raise exception 'Active status is not configured';
  end if;

  v_old := public.get_community_member(p_id)::jsonb;
  v_member_name := public.user_display_name(p_id);
  v_actor_name := public.user_display_name(p_actor_user_id);

  update public.users
  set
    status_id = v_status_id,
    failed_login_attempts = 0
  where id = p_id;

  v_new := public.get_community_member(p_id)::jsonb;

  perform public.write_user_activity_log(
    p_actor_user_id,
    'allow',
    public.menu_id_by_path('/community-members'),
    format('%s allowed %s.', v_actor_name, v_member_name),
    v_old,
    v_new
  );

  return json_build_object('ok', true, 'id', p_id);
end;
$$;

revoke all on function public.get_security_settings() from public;
revoke all on function public.update_security_settings(
  boolean, integer, boolean, integer, boolean, integer, boolean,
  boolean, integer, boolean, integer, boolean, integer, boolean, integer,
  boolean, integer, boolean, integer, boolean, boolean, boolean, bigint
) from public;
revoke all on function public.validate_session(bigint, uuid) from public;
revoke all on function public.logout_user(bigint) from public;
revoke all on function public.login_user(text, text) from public;

grant execute on function public.get_security_settings() to anon, authenticated;
grant execute on function public.update_security_settings(
  boolean, integer, boolean, integer, boolean, integer, boolean,
  boolean, integer, boolean, integer, boolean, integer, boolean, integer,
  boolean, integer, boolean, integer, boolean, boolean, boolean, bigint
) to anon, authenticated;
grant execute on function public.validate_session(bigint, uuid) to anon, authenticated;
grant execute on function public.logout_user(bigint) to anon, authenticated;
grant execute on function public.login_user(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
