-- Dual-party SMS: return complainant and respondent mobiles explicitly
-- so the edge function can send to each party reliably.

create or replace function public.get_repudiation_notify_info(p_complaint_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  select json_build_object(
    'barangay_case_no', c.barangay_case_no,
    'creator_role', coalesce(owner_role.name, ''),
    'complainant_user_id', c.user_id,
    'respondent_user_id', c.respondent_user_id,
    'complainant_mobile', (
      select nullif(btrim(ci.mobile_number), '')
      from public.contact_information ci
      where ci.user_id = c.user_id
    ),
    'respondent_mobile', (
      select nullif(btrim(ci.mobile_number), '')
      from public.contact_information ci
      where ci.user_id = c.respondent_user_id
    ),
    'recipients', coalesce(
      (
        select json_agg(
          json_build_object(
            'role', numbers.role,
            'user_id', numbers.user_id,
            'mobile_number', numbers.mobile_number
          )
          order by numbers.role
        )
        from (
          select
            'complainant'::text as role,
            c.user_id as user_id,
            nullif(btrim(comp_ci.mobile_number), '') as mobile_number
          from public.contact_information comp_ci
          where comp_ci.user_id = c.user_id
            and nullif(btrim(comp_ci.mobile_number), '') is not null
          union all
          select
            'respondent'::text as role,
            c.respondent_user_id as user_id,
            nullif(btrim(resp_ci.mobile_number), '') as mobile_number
          from public.contact_information resp_ci
          where c.respondent_user_id is not null
            and resp_ci.user_id = c.respondent_user_id
            and nullif(btrim(resp_ci.mobile_number), '') is not null
        ) numbers
      ),
      '[]'::json
    )
  )
  into v_result
  from public.complaints c
  join public.users owner_u on owner_u.id = c.user_id
  join public.roles owner_role on owner_role.id = owner_u.role_id
  where c.id = p_complaint_id;

  if v_result is null then
    raise exception 'Complaint not found';
  end if;

  return v_result;
end;
$$;

revoke all on function public.get_repudiation_notify_info(bigint) from public;
grant execute on function public.get_repudiation_notify_info(bigint) to anon, authenticated;

notify pgrst, 'reload schema';
