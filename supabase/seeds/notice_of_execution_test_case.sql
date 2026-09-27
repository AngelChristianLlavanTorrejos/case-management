-- One-off test case for Notice of Execution.
-- Full flow through Notice of Hearing (RE: Motion for Execution).
-- Appear On is 6 days ago so the 5-day wait has passed.
-- Does not insert a Notice of Execution.
-- Runs in one transaction: any failed insert rolls back the whole seed.

do $$
declare
  v_user_id bigint;
  v_type_id bigint;
  v_complaint_id bigint;
  v_motion_id bigint;
  v_case_no text;
  v_prefix text;
  v_seq integer;
  v_filed_at timestamptz := now() - interval '22 days';
  v_issued_at timestamptz := now() - interval '21 days';
  v_hearing_appear_at timestamptz := now() - interval '19 days';
  v_settled_at timestamptz := now() - interval '16 days';
  v_motion_at timestamptz := now() - interval '8 days';
  v_motion_hearing_issued_at timestamptz := now() - interval '7 days';
  v_motion_appear_at timestamptz := now() - interval '6 days';
begin
  select c.id, c.barangay_case_no
  into v_complaint_id, v_case_no
  from public.complaints c
  where exists (
    select 1
    from public.complaint_parties p
    where p.complaint_id = c.id
      and p.party_type = 'complainant'
      and p.name = 'Ana Lopez Rivera'
  )
    and exists (
      select 1
      from public.complaint_parties p
      where p.complaint_id = c.id
        and p.party_type = 'respondent'
        and p.name = 'Carlos Mendoza Diaz'
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
    'On 1 September 2026 at about 3:00 p.m. in Barangay Tanza 1, Navotas, the respondent failed to turn over the agreed personal property and later promised to comply before the Lupong Tagapamayapa.',
    'That the respondent deliver the personal property and pay the remaining sum stated in the amicable settlement.',
    now() - interval '24 days',
    true,
    v_filed_at,
    v_case_no,
    true
  )
  returning id into v_complaint_id;

  insert into public.complaint_parties (complaint_id, party_type, name, sort_order)
  values
    (v_complaint_id, 'complainant', 'Ana Lopez Rivera', 0),
    (v_complaint_id, 'respondent', 'Carlos Mendoza Diaz', 0);

  insert into public.notice_of_hearing (
    complaint_id,
    appear_at,
    issued_on,
    acknowledged_on,
    created_at
  )
  values (
    v_complaint_id,
    v_hearing_appear_at,
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
    v_hearing_appear_at,
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
    is_settled,
    status
  )
  values (
    v_complaint_id,
    'The respondent shall deliver the remaining personal property and pay Php 12,000.00 in two equal monthly installments of Php 6,000.00, beginning 10 September 2026, at the Barangay Tanza 1 hall.',
    v_settled_at,
    false,
    'notice_of_hearing_motion'
  );

  insert into public.motions_for_execution (complaint_id, created_at)
  values (v_complaint_id, v_motion_at)
  returning id into v_motion_id;

  insert into public.notices_of_hearing_motion (
    motion_id,
    appear_at,
    filed_by,
    issued_on,
    created_at
  )
  values (
    v_motion_id,
    v_motion_appear_at,
    'complainants',
    v_motion_hearing_issued_at,
    v_motion_hearing_issued_at
  );

  raise notice 'Created test case % (complaint %). Open Notice of Execution and add it.', v_case_no, v_complaint_id;
exception
  when others then
    raise exception 'Notice of Execution test seed failed. All changes were rolled back. %', sqlerrm;
end
$$;
