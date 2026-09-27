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
      c.received_and_filed_at,
      c.is_notice_and_summon_issued,
      n.created_at as notice_and_summon_issued_at
    from public.complaints c
    left join public.complaint_types ct on ct.id = c.complaint_type_id
    left join public.notice_of_hearing n on n.complaint_id = c.id
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
      received_and_filed_at,
      is_notice_and_summon_issued,
      notice_and_summon_issued_at
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
