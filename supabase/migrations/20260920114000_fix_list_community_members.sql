create or replace function public.list_community_members(
  p_status_group text,
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
  if p_status_group not in ('requests', 'residents') then
    raise exception 'Invalid status group';
  end if;

  v_offset := (v_page - 1) * v_page_size;

  with base as (
    select
      u.id,
      public.user_display_name(u.id) as display_name,
      date_part('year', age(current_date, pi.birthdate))::integer as age,
      sxn.name as sex_name,
      concat_ws(', ', ci.present_address_barangay, ci.present_address_municipality_city) as location,
      s.name as status_name
    from public.users u
    join public.roles r on r.id = u.role_id
    join public.status s on s.id = u.status_id
    join public.personal_information pi on pi.user_id = u.id
    join public.sex sxn on sxn.id = pi.sex_id
    join public.contact_information ci on ci.user_id = u.id
    where r.name = 'User'
      and (
        (p_status_group = 'requests' and lower(s.name) = 'for registration')
        or (p_status_group = 'residents' and lower(s.name) in ('active', 'inactive'))
      )
  ),
  filtered as (
    select *
    from base
    where v_search = ''
       or lower(display_name) like '%' || v_search || '%'
       or lower(location) like '%' || v_search || '%'
  ),
  counted as (
    select count(*)::integer as total from filtered
  ),
  paged as (
    select id, display_name, age, sex_name, location, status_name
    from filtered
    order by
      case when p_sort_key = 'age' and p_sort_dir = 'asc' then age end asc,
      case when p_sort_key = 'age' and p_sort_dir = 'desc' then age end desc,
      case when p_sort_key = 'sex_name' and p_sort_dir = 'asc' then sex_name end asc,
      case when p_sort_key = 'sex_name' and p_sort_dir = 'desc' then sex_name end desc,
      case when p_sort_key = 'location' and p_sort_dir = 'asc' then location end asc,
      case when p_sort_key = 'location' and p_sort_dir = 'desc' then location end desc,
      case when p_sort_key = 'status_name' and p_sort_dir = 'asc' then status_name end asc,
      case when p_sort_key = 'status_name' and p_sort_dir = 'desc' then status_name end desc,
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
