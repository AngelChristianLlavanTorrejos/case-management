-- Self-service password reset: service_role only.
-- Username + registered mobile must match an active account with a valid 09XXXXXXXXX number.

create or replace function public.normalize_ph_mobile(p_raw text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_digits text := regexp_replace(coalesce(p_raw, ''), '\D', '', 'g');
begin
  if v_digits ~ '^09[0-9]{9}$' then
    return v_digits;
  end if;
  if v_digits ~ '^639[0-9]{9}$' then
    return '0' || substr(v_digits, 3);
  end if;
  if v_digits ~ '^9[0-9]{9}$' then
    return '0' || v_digits;
  end if;
  return null;
end;
$$;

create or replace function public.verify_password_reset_request(
  p_username text,
  p_mobile text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text := btrim(coalesce(p_username, ''));
  v_mobile text := public.normalize_ph_mobile(p_mobile);
  v_user_id bigint;
  v_stored_username text;
  v_status text;
  v_stored_mobile text;
begin
  if v_username = '' or v_mobile is null then
    raise exception 'Username and mobile number do not match our records.';
  end if;

  select u.id, u.username, lower(s.name), public.normalize_ph_mobile(ci.mobile_number)
  into v_user_id, v_stored_username, v_status, v_stored_mobile
  from public.users u
  join public.status s on s.id = u.status_id
  left join public.contact_information ci on ci.user_id = u.id
  where u.username = v_username;

  if v_user_id is null then
    raise exception 'Username and mobile number do not match our records.';
  end if;

  if v_status is distinct from 'active' then
    raise exception 'Username and mobile number do not match our records.';
  end if;

  if v_stored_mobile is null then
    raise exception 'Password reset is not available. This account has no registered mobile number.';
  end if;

  if v_stored_mobile is distinct from v_mobile then
    raise exception 'Username and mobile number do not match our records.';
  end if;

  return json_build_object(
    'user_id', v_user_id,
    'username', v_stored_username,
    'mobile_number', v_stored_mobile
  );
end;
$$;

create or replace function public.generate_compliant_password(p_username text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_password text;
  v_length integer := 14;
  v_settings public.security_settings%rowtype;
  v_attempt integer := 0;
  v_lower text := 'abcdefghijkmnopqrstuvwxyz';
  v_upper text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_digits text := '23456789';
  v_special text := '!@#$%&*?';
  v_all text;
  v_bytes bytea;
  v_i integer;
  v_pool_len integer;
begin
  select * into v_settings from public.security_settings where id = 1;

  if found then
    if coalesce(v_settings.is_enable_min_length_password, false)
       and v_settings.min_length_password > v_length then
      v_length := v_settings.min_length_password;
    end if;
    if coalesce(v_settings.is_enable_max_length_password, false)
       and v_settings.max_length_password > 0
       and v_settings.max_length_password < v_length then
      v_length := greatest(v_settings.max_length_password, 8);
    end if;
  end if;

  v_length := least(greatest(v_length, 12), 20);
  v_all := v_lower || v_upper || v_digits || v_special;
  v_pool_len := char_length(v_all);

  loop
    v_attempt := v_attempt + 1;
    if v_attempt > 40 then
      raise exception 'Unable to generate a password that meets the current policy.';
    end if;

    v_bytes := extensions.gen_random_bytes(v_length);
    v_password :=
      substr(v_upper, 1 + (get_byte(v_bytes, 0) % char_length(v_upper)), 1)
      || substr(v_lower, 1 + (get_byte(v_bytes, 1) % char_length(v_lower)), 1)
      || substr(v_digits, 1 + (get_byte(v_bytes, 2) % char_length(v_digits)), 1)
      || substr(v_special, 1 + (get_byte(v_bytes, 3) % char_length(v_special)), 1);

    for v_i in 4 .. (v_length - 1) loop
      v_password := v_password || substr(v_all, 1 + (get_byte(v_bytes, v_i) % v_pool_len), 1);
    end loop;

    begin
      perform public.assert_password_policy(v_password, coalesce(p_username, ''));
      return v_password;
    exception
      when others then
        null;
    end;
  end loop;

  raise exception 'Unable to generate a password that meets the current policy.';
end;
$$;

create or replace function public.apply_password_reset(
  p_user_id bigint,
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
  if p_user_id is null or btrim(coalesce(p_new_password, '')) = '' then
    raise exception 'Unable to reset password.';
  end if;

  select * into v_user from public.users where id = p_user_id;
  if not found then
    raise exception 'Unable to reset password.';
  end if;

  perform public.assert_password_policy(p_new_password, v_user.username);

  update public.users
  set
    password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
    should_change_password = true,
    failed_login_attempts = 0
  where id = p_user_id;

  v_actor_name := public.user_display_name(p_user_id);

  perform public.write_user_activity_log(
    p_user_id,
    'edit',
    public.menu_id_by_path('/change-password'),
    format('%s reset their password.', v_actor_name),
    jsonb_build_object('should_change_password', v_user.should_change_password),
    jsonb_build_object('should_change_password', true)
  );

  return json_build_object('ok', true, 'id', p_user_id);
end;
$$;

revoke all on function public.normalize_ph_mobile(text) from public;
revoke all on function public.verify_password_reset_request(text, text) from public;
revoke all on function public.generate_compliant_password(text) from public;
revoke all on function public.apply_password_reset(bigint, text) from public;

grant execute on function public.normalize_ph_mobile(text) to service_role;
grant execute on function public.verify_password_reset_request(text, text) to service_role;
grant execute on function public.generate_compliant_password(text) to service_role;
grant execute on function public.apply_password_reset(bigint, text) to service_role;

notify pgrst, 'reload schema';
