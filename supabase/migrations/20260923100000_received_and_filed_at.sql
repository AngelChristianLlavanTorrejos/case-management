alter table public.complaints
  add column received_and_filed_at timestamptz;

update public.complaints
set received_and_filed_at = created_at
where is_received_and_filed
  and received_and_filed_at is null;

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
      ) as respondents,
      c.is_received_and_filed,
      c.received_and_filed_at
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
    select
      id,
      created_at,
      complaint_type,
      complainants,
      respondents,
      is_received_and_filed,
      received_and_filed_at
    from filtered
    order by
      case when p_sort_key = 'complaint_type' and p_sort_dir = 'asc' then complaint_type end asc,
      case when p_sort_key = 'complaint_type' and p_sort_dir = 'desc' then complaint_type end desc,
      case when p_sort_key = 'complainants' and p_sort_dir = 'asc' then complainants end asc,
      case when p_sort_key = 'complainants' and p_sort_dir = 'desc' then complainants end desc,
      case when p_sort_key = 'respondents' and p_sort_dir = 'asc' then respondents end asc,
      case when p_sort_key = 'respondents' and p_sort_dir = 'desc' then respondents end desc,
      case when p_sort_key = 'is_received_and_filed' and p_sort_dir = 'asc' then is_received_and_filed end asc,
      case when p_sort_key = 'is_received_and_filed' and p_sort_dir = 'desc' then is_received_and_filed end desc,
      case when p_sort_key = 'received_and_filed_at' and p_sort_dir = 'asc' then received_and_filed_at end asc,
      case when p_sort_key = 'received_and_filed_at' and p_sort_dir = 'desc' then received_and_filed_at end desc,
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
    'is_received_and_filed', c.is_received_and_filed,
    'received_and_filed_at', c.received_and_filed_at,
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

create or replace function public.mark_complaint_received_and_filed(
  p_id bigint,
  p_actor_user_id bigint
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
  v_already boolean;
  v_received_at timestamptz;
begin
  perform public.require_activity_actor(p_actor_user_id);

  select c.is_received_and_filed, coalesce(ct.name, '—')
  into v_already, v_type_name
  from public.complaints c
  left join public.complaint_types ct on ct.id = c.complaint_type_id
  where c.id = p_id;

  if not found then
    raise exception 'Complaint not found';
  end if;

  if v_already then
    raise exception 'This complaint is already received and filed.';
  end if;

  select public.get_complaint(p_id)::jsonb into v_old;

  v_received_at := now();

  update public.complaints
  set
    is_received_and_filed = true,
    received_and_filed_at = v_received_at
  where id = p_id;

  v_actor_name := public.user_display_name(p_actor_user_id);

  perform public.write_user_activity_log(
    p_actor_user_id,
    'edit',
    public.menu_id_by_path('/complainants-form'),
    format('%s marked a complainant''s form as received and filed (%s).', v_actor_name, v_type_name),
    v_old,
    jsonb_build_object(
      'id', p_id,
      'is_received_and_filed', true,
      'received_and_filed_at', v_received_at
    )
  );

  return json_build_object('ok', true, 'id', p_id);
end;
$$;

revoke all on function public.list_complaints(text, text, text, integer, integer) from public;
grant execute on function public.list_complaints(text, text, text, integer, integer) to anon, authenticated;

revoke all on function public.get_complaint(bigint) from public;
grant execute on function public.get_complaint(bigint) to anon, authenticated;

revoke all on function public.mark_complaint_received_and_filed(bigint, bigint) from public;
grant execute on function public.mark_complaint_received_and_filed(bigint, bigint) to anon, authenticated;

notify pgrst, 'reload schema';
