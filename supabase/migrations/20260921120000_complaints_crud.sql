create or replace function public.list_complaints(
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
      c.id,
      c.created_at,
      coalesce(ct.name, '—') as complaint_type,
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
    left join public.complaint_types ct on ct.id = c.complaint_type_id
  ),
  filtered as (
    select *
    from base
    where v_search = ''
       or lower(complaint_type) like '%' || v_search || '%'
       or lower(complainants) like '%' || v_search || '%'
       or lower(respondents) like '%' || v_search || '%'
  ),
  counted as (
    select count(*)::integer as total from filtered
  ),
  paged as (
    select id, created_at, complaint_type, complainants, respondents
    from filtered
    order by
      case when p_sort_key = 'complaint_type' and p_sort_dir = 'asc' then complaint_type end asc,
      case when p_sort_key = 'complaint_type' and p_sort_dir = 'desc' then complaint_type end desc,
      case when p_sort_key = 'complainants' and p_sort_dir = 'asc' then complainants end asc,
      case when p_sort_key = 'complainants' and p_sort_dir = 'desc' then complainants end desc,
      case when p_sort_key = 'respondents' and p_sort_dir = 'asc' then respondents end asc,
      case when p_sort_key = 'respondents' and p_sort_dir = 'desc' then respondents end desc,
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

create or replace function public.get_complaint(p_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  select json_build_object(
    'id', c.id,
    'complaint_type_id', c.complaint_type_id,
    'complaint_type', coalesce(ct.name, '—'),
    'manner', c.manner,
    'relief', c.relief,
    'created_at', c.created_at,
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
    )
  )
  into v_result
  from public.complaints c
  left join public.complaint_types ct on ct.id = c.complaint_type_id
  where c.id = p_id;

  if v_result is null then
    raise exception 'Complaint not found';
  end if;

  return v_result;
end;
$$;

create or replace function public.update_complaint(
  p_id bigint,
  p_actor_user_id bigint,
  p_complaint_type_id bigint,
  p_complainants text[],
  p_respondents text[],
  p_manner text,
  p_relief text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_actor_name text;
  v_type_name text;
  v_complainants text[];
  v_respondents text[];
  v_manner text := btrim(coalesce(p_manner, ''));
  v_relief text := btrim(coalesce(p_relief, ''));
  v_name text;
  v_index integer;
begin
  perform public.require_activity_actor(p_actor_user_id);

  select public.get_complaint(p_id)::jsonb into v_old;

  select name into v_type_name
  from public.complaint_types
  where id = p_complaint_type_id;

  if not found then
    raise exception 'Complaint type is required.';
  end if;

  select array_agg(btrim(value) order by ordinality)
  into v_complainants
  from unnest(coalesce(p_complainants, array[]::text[])) with ordinality as t(value, ordinality)
  where char_length(btrim(value)) > 0;

  select array_agg(btrim(value) order by ordinality)
  into v_respondents
  from unnest(coalesce(p_respondents, array[]::text[])) with ordinality as t(value, ordinality)
  where char_length(btrim(value)) > 0;

  if coalesce(array_length(v_complainants, 1), 0) < 1 then
    raise exception 'Add at least one complainant.';
  end if;

  if coalesce(array_length(v_respondents, 1), 0) < 1 then
    raise exception 'Add at least one respondent.';
  end if;

  if char_length(v_manner) = 0 then
    raise exception 'Describe how your rights and interests were violated.';
  end if;

  if char_length(v_relief) = 0 then
    raise exception 'Describe the relief you are praying for.';
  end if;

  update public.complaints
  set
    complaint_type_id = p_complaint_type_id,
    manner = v_manner,
    relief = v_relief
  where id = p_id;

  if not found then
    raise exception 'Complaint not found';
  end if;

  delete from public.complaint_parties where complaint_id = p_id;

  v_index := 0;
  foreach v_name in array v_complainants loop
    v_index := v_index + 1;
    insert into public.complaint_parties (complaint_id, party_type, name, sort_order)
    values (p_id, 'complainant', v_name, v_index);
  end loop;

  v_index := 0;
  foreach v_name in array v_respondents loop
    v_index := v_index + 1;
    insert into public.complaint_parties (complaint_id, party_type, name, sort_order)
    values (p_id, 'respondent', v_name, v_index);
  end loop;

  v_actor_name := public.user_display_name(p_actor_user_id);

  perform public.write_user_activity_log(
    p_actor_user_id,
    'edit',
    public.menu_id_by_path('/complainants-form'),
    format('%s updated a complainant''s form (%s).', v_actor_name, v_type_name),
    v_old,
    jsonb_build_object(
      'id', p_id,
      'complaint_type_id', p_complaint_type_id,
      'complaint_type', v_type_name,
      'complainants', to_jsonb(v_complainants),
      'respondents', to_jsonb(v_respondents),
      'manner', v_manner,
      'relief', v_relief
    )
  );

  return json_build_object('ok', true, 'id', p_id);
end;
$$;

create or replace function public.delete_complaint(p_id bigint, p_actor_user_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_actor_name text;
  v_type_name text;
begin
  perform public.require_activity_actor(p_actor_user_id);

  select public.get_complaint(p_id)::jsonb into v_old;
  v_type_name := coalesce(v_old ->> 'complaint_type', '—');

  delete from public.complaints where id = p_id;
  if not found then
    raise exception 'Complaint not found';
  end if;

  v_actor_name := public.user_display_name(p_actor_user_id);

  perform public.write_user_activity_log(
    p_actor_user_id,
    'delete',
    public.menu_id_by_path('/complainants-form'),
    format('%s deleted a complainant''s form (%s).', v_actor_name, v_type_name),
    v_old,
    null
  );

  return json_build_object('ok', true, 'id', p_id);
end;
$$;

revoke all on function public.list_complaints(text, text, text, integer, integer) from public;
revoke all on function public.get_complaint(bigint) from public;
revoke all on function public.update_complaint(bigint, bigint, bigint, text[], text[], text, text) from public;
revoke all on function public.delete_complaint(bigint, bigint) from public;

grant execute on function public.list_complaints(text, text, text, integer, integer) to anon, authenticated;
grant execute on function public.get_complaint(bigint) to anon, authenticated;
grant execute on function public.update_complaint(bigint, bigint, bigint, text[], text[], text, text) to anon, authenticated;
grant execute on function public.delete_complaint(bigint, bigint) to anon, authenticated;

notify pgrst, 'reload schema';
