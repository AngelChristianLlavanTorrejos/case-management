-- One-off test case for Motion for Execution.
-- Settlement is 12 days old, not settled, no repudiation.

do $$
declare
  v_user_id bigint;
  v_type_id bigint;
  v_complaint_id bigint;
  v_case_no text;
  v_prefix text;
  v_seq integer;
  v_filed_at timestamptz := now() - interval '18 days';
  v_issued_at timestamptz := now() - interval '17 days';
  v_appear_at timestamptz := now() - interval '15 days';
  v_settled_at timestamptz := now() - interval '12 days';
begin
  select c.id, c.barangay_case_no
  into v_complaint_id, v_case_no
  from public.complaints c
  where exists (
    select 1
    from public.complaint_parties p
    where p.complaint_id = c.id
      and p.party_type = 'complainant'
      and p.name = 'Maria Santos Cruz'
  )
    and exists (
      select 1
      from public.complaint_parties p
      where p.complaint_id = c.id
        and p.party_type = 'respondent'
        and p.name = 'Pedro Reyes Alvarez'
    );

  if v_complaint_id is not null then
    raise notice 'Test case already exists (%).', v_case_no;
    return;
  end if;

  v_user_id := 8;

  if not exists (select 1 from public.users where id = v_user_id) then
    raise exception 'User 8 was not found.';
  end if;

  select id into v_type_id
  from public.complaint_types
  order by id
  limit 1;

  if v_type_id is null then
    raise exception 'No complaint type found. Add a complaint type first.';
  end if;

  v_prefix := to_char(v_filed_at, 'YYYY') || '-TANZA-';

  select coalesce(max(substring(c.barangay_case_no from '[0-9]+$')::int), 0) + 1
  into v_seq
  from public.complaints c
  where c.barangay_case_no like v_prefix || '%';

  v_case_no := v_prefix || lpad(v_seq::text, 5, '0');

  insert into public.complaints (
    user_id,
    complaint_type_id,
    manner,
    relief,
    created_at,
    is_received_and_filed,
    received_and_filed_at,
    barangay_case_no,
    is_notice_and_summon_issued
  )
  values (
    v_user_id,
    v_type_id,
    'On 7 September 2026 at about 4:00 p.m. in Barangay Tanza 1, Navotas, the respondent refused to return the borrowed amount of Php 15,000.00 and verbally agreed to settle before the Lupong Tagapamayapa.',
    'That the respondent pay the remaining Php 15,000.00 and comply with the terms of the amicable settlement.',
    now() - interval '20 days',
    true,
    v_filed_at,
    v_case_no,
    true
  )
  returning id into v_complaint_id;

  insert into public.complaint_parties (complaint_id, party_type, name, sort_order)
  values
    (v_complaint_id, 'complainant', 'Maria Santos Cruz', 0),
    (v_complaint_id, 'respondent', 'Pedro Reyes Alvarez', 0);

  insert into public.notice_of_hearing (
    complaint_id,
    appear_at,
    issued_on,
    acknowledged_on,
    created_at
  )
  values (
    v_complaint_id,
    v_appear_at,
    v_issued_at,
    v_issued_at + interval '1 day',
    v_issued_at
  );

  insert into public.summons (
    complaint_id,
    appear_at,
    issued_on,
    served_on,
    dwelling_recipient,
    office_recipient,
    officer_in_charge,
    created_at
  )
  values (
    v_complaint_id,
    v_appear_at,
    v_issued_at,
    v_issued_at + interval '1 day',
    null,
    null,
    'Roberto Mendoza',
    v_issued_at
  );

  insert into public.amicable_settlements (
    complaint_id,
    terms,
    created_at,
    is_settled
  )
  values (
    v_complaint_id,
    'The respondent shall pay the complainant Php 15,000.00 in three equal monthly installments of Php 5,000.00, beginning 20 September 2026, at the Barangay Tanza 1 hall.',
    v_settled_at,
    false
  );

  raise notice 'Created test case % (complaint %). Use it on Motion for Execution.', v_case_no, v_complaint_id;
end
$$;
