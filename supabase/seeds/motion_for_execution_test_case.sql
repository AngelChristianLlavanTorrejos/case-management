-- One-off test case for Motion for Execution.
-- Settlement is 12 days old, status null, not settled, no repudiation, no motion.
-- Re-run safe: if the parties already exist, repairs eligibility instead of exiting quietly.

do $$
declare
  v_user_id bigint;
  v_type_id bigint;
  v_complaint_id bigint;
  v_settlement_id bigint;
  v_case_no text;
  v_prefix text;
  v_seq integer;
  v_filed_at timestamptz := now() - interval '18 days';
  v_issued_at timestamptz := now() - interval '17 days';
  v_appear_at timestamptz := now() - interval '15 days';
  v_settled_at timestamptz := now() - interval '12 days';
  v_action text := 'created';
  v_has_motion boolean := false;
  v_has_repudiation boolean := false;
  v_eligible boolean := false;
  v_age_days numeric;
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
    )
  order by c.id
  limit 1;

  if v_complaint_id is not null then
    v_action := 'repaired';

    -- Clear later execution-path records so the case becomes eligible again.
    -- notices_of_hearing_motion / notices_of_execution cascade from the motion.
    delete from public.motions_for_execution
    where complaint_id = v_complaint_id;

    delete from public.repudiations
    where complaint_id = v_complaint_id;

    update public.amicable_settlements
    set created_at = v_settled_at,
        is_settled = false,
        status = null
    where complaint_id = v_complaint_id
    returning id into v_settlement_id;

    if v_settlement_id is null then
      insert into public.amicable_settlements (
        complaint_id,
        terms,
        created_at,
        is_settled,
        status
      )
      values (
        v_complaint_id,
        'The respondent shall pay the complainant Php 15,000.00 in three equal monthly installments of Php 5,000.00, beginning 20 September 2026, at the Barangay Tanza 1 hall.',
        v_settled_at,
        false,
        null
      )
      returning id into v_settlement_id;
    end if;

    select exists (
      select 1 from public.motions_for_execution m where m.complaint_id = v_complaint_id
    ) into v_has_motion;

    select exists (
      select 1 from public.repudiations r where r.complaint_id = v_complaint_id
    ) into v_has_repudiation;

    if v_has_motion or v_has_repudiation then
      raise exception
        'Could not clear blocking records for test case %.',
        v_case_no;
    end if;
  else
    if exists (select 1 from public.users where id = 11) then
      v_user_id := 11;
    else
      select u.id
      into v_user_id
      from public.users u
      join public.roles r on r.id = u.role_id
      where r.name in ('Super Admin', 'Admin')
      order by u.id
      limit 1;
    end if;

    if v_user_id is null then
      raise exception 'No staff user found (tried id 8, then Super Admin/Admin).';
    end if;

    select id into v_type_id
    from public.complaint_types
    order by id
    limit 1;

    if v_type_id is null then
      raise exception 'No complaint type found. Add a complaint type first.';
    end if;

    v_prefix := to_char(v_filed_at, 'YYYY') || '-TANZA-';

    select coalesce(
      max(
        case
          when c.barangay_case_no ~ ('^' || v_prefix || '[0-9]{5}$')
            then right(c.barangay_case_no, 5)::int
          else 0
        end
      ),
      0
    ) + 1
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
      v_issued_at::date,
      (v_issued_at + interval '1 day')::date,
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
      v_issued_at::date,
      (v_issued_at + interval '1 day')::date,
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
      'The respondent shall pay the complainant Php 15,000.00 in three equal monthly installments of Php 5,000.00, beginning 20 September 2026, at the Barangay Tanza 1 hall.',
      v_settled_at,
      false,
      null
    )
    returning id into v_settlement_id;
  end if;

  select
    round(extract(epoch from (now() - s.created_at)) / 86400.0, 1),
    (
      s.created_at < now() - interval '10 days'
      and s.status is null
      and not exists (select 1 from public.repudiations r where r.complaint_id = c.id)
      and not exists (select 1 from public.motions_for_execution m where m.complaint_id = c.id)
    )
  into v_age_days, v_eligible
  from public.complaints c
  join public.amicable_settlements s on s.complaint_id = c.id
  where c.id = v_complaint_id;

  if not v_eligible then
    raise exception
      'Seed finished but case % is still not eligible for Motion for Execution.',
      v_case_no;
  end if;

  raise notice
    'Motion seed %: case %, complaint %, settlement %, age % days, eligible=%',
    v_action, v_case_no, v_complaint_id, v_settlement_id, v_age_days, v_eligible;
exception
  when others then
    raise exception 'Motion for Execution test seed failed. All changes were rolled back. %', sqlerrm;
end
$$;

-- Confirm the seeded case is eligible (this is the row the SQL Editor will show).
select
  c.barangay_case_no,
  c.id as complaint_id,
  s.id as settlement_id,
  round(extract(epoch from (now() - s.created_at)) / 86400.0, 1) as settlement_age_days,
  s.status,
  (
    s.created_at < now() - interval '10 days'
    and s.status is null
    and not exists (select 1 from public.repudiations r where r.complaint_id = c.id)
    and not exists (select 1 from public.motions_for_execution m where m.complaint_id = c.id)
  ) as eligible_for_motion
from public.complaints c
join public.amicable_settlements s on s.complaint_id = c.id
join public.complaint_parties cp on cp.complaint_id = c.id
  and cp.party_type = 'complainant'
  and cp.name = 'Maria Santos Cruz'
where exists (
  select 1
  from public.complaint_parties rp
  where rp.complaint_id = c.id
    and rp.party_type = 'respondent'
    and rp.name = 'Pedro Reyes Alvarez'
);
