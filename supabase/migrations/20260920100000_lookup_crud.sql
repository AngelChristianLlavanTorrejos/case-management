create or replace function public.create_suffix(p_name text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(p_name);
  v_row public.suffixes%rowtype;
begin
  if v_name is null or char_length(v_name) = 0 then
    raise exception 'Name is required';
  end if;

  if exists (select 1 from public.suffixes where lower(name) = lower(v_name)) then
    raise exception 'Suffix "%" already exists', v_name;
  end if;

  insert into public.suffixes (name)
  values (v_name)
  returning * into v_row;

  return to_json(v_row);
end;
$$;

create or replace function public.update_suffix(p_id bigint, p_name text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(p_name);
  v_row public.suffixes%rowtype;
begin
  if v_name is null or char_length(v_name) = 0 then
    raise exception 'Name is required';
  end if;

  select * into v_row from public.suffixes where id = p_id;
  if not found then
    raise exception 'Suffix not found';
  end if;

  if v_row.can_delete is false then
    raise exception 'System value "%" cannot be edited', v_row.name;
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

  return to_json(v_row);
end;
$$;

create or replace function public.delete_suffix(p_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.suffixes%rowtype;
begin
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

  return json_build_object('ok', true, 'id', p_id);
end;
$$;

create or replace function public.create_civil_status(p_name text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(p_name);
  v_row public.civil_status%rowtype;
begin
  if v_name is null or char_length(v_name) = 0 then
    raise exception 'Name is required';
  end if;

  if exists (select 1 from public.civil_status where lower(name) = lower(v_name)) then
    raise exception 'Civil status "%" already exists', v_name;
  end if;

  insert into public.civil_status (name)
  values (v_name)
  returning * into v_row;

  return to_json(v_row);
end;
$$;

create or replace function public.update_civil_status(p_id bigint, p_name text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(p_name);
  v_row public.civil_status%rowtype;
begin
  if v_name is null or char_length(v_name) = 0 then
    raise exception 'Name is required';
  end if;

  select * into v_row from public.civil_status where id = p_id;
  if not found then
    raise exception 'Civil status not found';
  end if;

  if v_row.can_delete is false then
    raise exception 'System value "%" cannot be edited', v_row.name;
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

  return to_json(v_row);
end;
$$;

create or replace function public.delete_civil_status(p_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.civil_status%rowtype;
begin
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

  return json_build_object('ok', true, 'id', p_id);
end;
$$;

revoke all on function public.create_suffix(text) from public;
revoke all on function public.update_suffix(bigint, text) from public;
revoke all on function public.delete_suffix(bigint) from public;
revoke all on function public.create_civil_status(text) from public;
revoke all on function public.update_civil_status(bigint, text) from public;
revoke all on function public.delete_civil_status(bigint) from public;

grant execute on function public.create_suffix(text) to anon, authenticated;
grant execute on function public.update_suffix(bigint, text) to anon, authenticated;
grant execute on function public.delete_suffix(bigint) to anon, authenticated;
grant execute on function public.create_civil_status(text) to anon, authenticated;
grant execute on function public.update_civil_status(bigint, text) to anon, authenticated;
grant execute on function public.delete_civil_status(bigint) to anon, authenticated;
