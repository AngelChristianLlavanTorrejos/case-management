alter table public.complaints
  add column barangay_case_no text;

create unique index complaints_barangay_case_no_uidx
  on public.complaints (barangay_case_no)
  where barangay_case_no is not null;

with numbered as (
  select
    id,
    to_char(coalesce(received_and_filed_at, created_at), 'YYYY') as yr,
    row_number() over (
      partition by to_char(coalesce(received_and_filed_at, created_at), 'YYYY')
      order by received_and_filed_at, id
    ) as seq
  from public.complaints
  where is_received_and_filed
    and barangay_case_no is null
)
update public.complaints c
set barangay_case_no = n.yr || '-TANZA-' || lpad(n.seq::text, 5, '0')
from numbered n
where c.id = n.id;

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
    'barangay_case_no', c.barangay_case_no,
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
  v_year text;
  v_prefix text;
  v_seq integer;
  v_case_no text;
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
  v_year := to_char(v_received_at, 'YYYY');
  v_prefix := v_year || '-TANZA-';

  select coalesce(max(substring(c.barangay_case_no from '[0-9]+$')::int), 0) + 1
  into v_seq
  from public.complaints c
  where c.barangay_case_no like v_prefix || '%';

  v_case_no := v_prefix || lpad(v_seq::text, 5, '0');

  update public.complaints
  set
    is_received_and_filed = true,
    received_and_filed_at = v_received_at,
    barangay_case_no = v_case_no
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
      'received_and_filed_at', v_received_at,
      'barangay_case_no', v_case_no
    )
  );

  return json_build_object('ok', true, 'id', p_id);
end;
$$;

revoke all on function public.get_complaint(bigint) from public;
grant execute on function public.get_complaint(bigint) to anon, authenticated;

revoke all on function public.mark_complaint_received_and_filed(bigint, bigint) from public;
grant execute on function public.mark_complaint_received_and_filed(bigint, bigint) to anon, authenticated;

notify pgrst, 'reload schema';
