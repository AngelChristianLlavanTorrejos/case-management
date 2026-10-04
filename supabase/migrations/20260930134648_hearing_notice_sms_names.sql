create or replace function public.get_complaint_notify_info(p_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  select json_build_object(
    'mobile_number', ci.mobile_number,
    'barangay_case_no', c.barangay_case_no,
    'appear_at', n.appear_at,
    'complainants', coalesce(
      (
        select string_agg(p.name, ', ' order by p.sort_order)
        from public.complaint_parties p
        where p.complaint_id = c.id and p.party_type = 'complainant'
      ),
      ''
    )
  )
  into v_result
  from public.complaints c
  left join public.contact_information ci on ci.user_id = c.user_id
  left join public.notice_of_hearing n on n.complaint_id = c.id
  where c.id = p_id;

  if v_result is null then
    raise exception 'Complaint not found';
  end if;

  return v_result;
end;
$$;

revoke all on function public.get_complaint_notify_info(bigint) from public;
grant execute on function public.get_complaint_notify_info(bigint) to anon, authenticated;

notify pgrst, 'reload schema';
