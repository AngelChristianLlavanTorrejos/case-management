-- Notice of Hearing: a User can open only notices for cases they created.

create or replace function public.get_notice_of_hearing(p_id bigint, p_actor_user_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
  v_owner_id bigint;
  v_role_name text;
begin
  perform public.require_activity_actor(p_actor_user_id);

  select r.name
  into v_role_name
  from public.users u
  join public.roles r on r.id = u.role_id
  where u.id = p_actor_user_id;

  if v_role_name is null then
    raise exception 'Actor not found';
  end if;

  select c.user_id
  into v_owner_id
  from public.notice_of_hearing n
  join public.complaints c on c.id = n.complaint_id
  where n.id = p_id;

  if not found or (v_role_name = 'User' and v_owner_id is distinct from p_actor_user_id) then
    raise exception 'Notice of hearing not found';
  end if;

  select json_build_object(
    'id', n.id,
    'complaint_id', n.complaint_id,
    'barangay_case_no', c.barangay_case_no,
    'complainants', coalesce(
      (
        select string_agg(p.name, ', ' order by p.sort_order)
        from public.complaint_parties p
        where p.complaint_id = c.id and p.party_type = 'complainant'
      ),
      ''
    ),
    'appear_at', n.appear_at,
    'issued_on', n.issued_on,
    'acknowledged_on', n.acknowledged_on,
    'status', case when n.acknowledged_on is null then 'Pending' else 'Acknowledged' end
  )
  into v_result
  from public.notice_of_hearing n
  join public.complaints c on c.id = n.complaint_id
  where n.id = p_id;

  if v_result is null then
    raise exception 'Notice of hearing not found';
  end if;

  return v_result;
end;
$$;

create or replace function public.update_notice_of_hearing(
  p_id bigint,
  p_actor_user_id bigint,
  p_appear_at timestamptz,
  p_acknowledged_on timestamptz default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_case_no text;
  v_actor_name text;
begin
  perform public.require_activity_actor(p_actor_user_id);

  if p_appear_at is null then
    raise exception 'Appear on is required.';
  end if;

  select public.get_notice_of_hearing(p_id, p_actor_user_id)::jsonb, c.barangay_case_no
  into v_old, v_case_no
  from public.notice_of_hearing n
  join public.complaints c on c.id = n.complaint_id
  where n.id = p_id;

  if not found then
    raise exception 'Notice of hearing not found';
  end if;

  update public.notice_of_hearing
  set
    appear_at = p_appear_at,
    acknowledged_on = p_acknowledged_on
  where id = p_id;

  v_actor_name := public.user_display_name(p_actor_user_id);

  perform public.write_user_activity_log(
    p_actor_user_id,
    'edit',
    public.menu_id_by_path('/notice-of-hearing'),
    format('%s updated a notice of hearing (%s).', v_actor_name, coalesce(v_case_no, '—')),
    v_old,
    public.get_notice_of_hearing(p_id, p_actor_user_id)::jsonb
  );

  return json_build_object('ok', true, 'id', p_id);
end;
$$;

drop function if exists public.get_notice_of_hearing(bigint);

drop function if exists public.list_notices_of_hearing(text, text, text, integer, integer);

create or replace function public.list_notices_of_hearing(
  p_search text default '',
  p_sort_key text default 'issued_on',
  p_sort_dir text default 'desc',
  p_page integer default 1,
  p_page_size integer default 10,
  p_actor_user_id bigint default null
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
  v_role_name text;
begin
  perform public.require_activity_actor(p_actor_user_id);

  select r.name
  into v_role_name
  from public.users u
  join public.roles r on r.id = u.role_id
  where u.id = p_actor_user_id;

  if v_role_name is null then
    raise exception 'Actor not found';
  end if;

  v_offset := (v_page - 1) * v_page_size;

  with base as (
    select
      n.id,
      n.complaint_id,
      c.barangay_case_no,
      coalesce(
        (
          select string_agg(p.name, ', ' order by p.sort_order)
          from public.complaint_parties p
          where p.complaint_id = c.id and p.party_type = 'complainant'
        ),
        ''
      ) as complainants,
      n.appear_at,
      n.issued_on,
      n.acknowledged_on,
      case when n.acknowledged_on is null then 'Pending' else 'Acknowledged' end as status
    from public.notice_of_hearing n
    join public.complaints c on c.id = n.complaint_id
    where v_role_name <> 'User'
       or c.user_id = p_actor_user_id
  ),
  filtered as (
    select *
    from base
    where v_search = ''
       or lower(coalesce(barangay_case_no, '')) like '%' || v_search || '%'
       or lower(complainants) like '%' || v_search || '%'
  ),
  counted as (
    select count(*)::integer as total from filtered
  ),
  paged as (
    select *
    from filtered
    order by
      case when p_sort_key = 'barangay_case_no' and p_sort_dir = 'asc' then barangay_case_no end asc,
      case when p_sort_key = 'barangay_case_no' and p_sort_dir = 'desc' then barangay_case_no end desc,
      case when p_sort_key = 'complainants' and p_sort_dir = 'asc' then complainants end asc,
      case when p_sort_key = 'complainants' and p_sort_dir = 'desc' then complainants end desc,
      case when p_sort_key = 'appear_at' and p_sort_dir = 'asc' then appear_at end asc,
      case when p_sort_key = 'appear_at' and p_sort_dir = 'desc' then appear_at end desc,
      case when p_sort_key = 'issued_on' and p_sort_dir = 'asc' then issued_on end asc,
      case when p_sort_key = 'issued_on' and p_sort_dir = 'desc' then issued_on end desc,
      case when p_sort_key = 'acknowledged_on' and p_sort_dir = 'asc' then acknowledged_on end asc,
      case when p_sort_key = 'acknowledged_on' and p_sort_dir = 'desc' then acknowledged_on end desc,
      case when p_sort_key = 'status' and p_sort_dir = 'asc' then status end asc,
      case when p_sort_key = 'status' and p_sort_dir = 'desc' then status end desc,
      issued_on desc,
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

revoke all on function public.get_notice_of_hearing(bigint, bigint) from public;
revoke all on function public.list_notices_of_hearing(text, text, text, integer, integer, bigint) from public;
revoke all on function public.update_notice_of_hearing(bigint, bigint, timestamptz, timestamptz) from public;

grant execute on function public.get_notice_of_hearing(bigint, bigint) to anon, authenticated;
grant execute on function public.list_notices_of_hearing(text, text, text, integer, integer, bigint) to anon, authenticated;
grant execute on function public.update_notice_of_hearing(bigint, bigint, timestamptz, timestamptz) to anon, authenticated;

notify pgrst, 'reload schema';
