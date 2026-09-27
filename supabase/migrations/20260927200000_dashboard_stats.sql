create or replace function public.get_dashboard_stats(p_period text default 'month')
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period text := case
    when lower(btrim(coalesce(p_period, ''))) = 'year' then 'year'
    else 'month'
  end;
  v_local_now timestamp := now() at time zone 'Asia/Manila';
  v_start_local timestamp;
  v_end_local timestamp;
  v_year_start timestamp := date_trunc('year', now() at time zone 'Asia/Manila');
  v_start timestamptz;
  v_end timestamptz;
  v_complaints_filed integer;
  v_notice_overdue integer;
  v_summons_unserved integer;
  v_settlements integer;
  v_repudiated integer;
  v_complied integer;
  v_in_execution integer;
  v_settlement_only integer;
  v_mix json;
  v_monthly json;
  v_attention json;
begin
  if v_period = 'year' then
    v_start_local := date_trunc('year', v_local_now);
    v_end_local := v_start_local + interval '1 year';
  else
    v_start_local := date_trunc('month', v_local_now);
    v_end_local := v_start_local + interval '1 month';
  end if;

  v_start := v_start_local at time zone 'Asia/Manila';
  v_end := v_end_local at time zone 'Asia/Manila';

  select count(*)::integer
  into v_complaints_filed
  from public.complaints c
  where c.created_at >= v_start
    and c.created_at < v_end;

  select count(*)::integer
  into v_notice_overdue
  from public.complaints c
  left join public.notice_of_hearing n on n.complaint_id = c.id
  where c.is_received_and_filed
    and c.received_and_filed_at is not null
    and c.received_and_filed_at >= v_start
    and c.received_and_filed_at < v_end
    and (
      (
        c.is_notice_and_summon_issued
        and n.created_at > c.received_and_filed_at + interval '3 days'
      )
      or (
        not c.is_notice_and_summon_issued
        and now() > c.received_and_filed_at + interval '3 days'
      )
    );

  select count(*)::integer
  into v_summons_unserved
  from public.summons s
  where s.served_on is null
    and s.issued_on >= v_start
    and s.issued_on < v_end;

  select
    count(*)::integer,
    count(*) filter (where s.status = 'repudiated')::integer,
    count(*) filter (where s.status = 'settled')::integer,
    count(*) filter (
      where s.status in ('motion_for_execution', 'notice_of_hearing_motion', 'notice_of_execution')
    )::integer,
    count(*) filter (where s.status is null)::integer
  into v_settlements, v_repudiated, v_complied, v_in_execution, v_settlement_only
  from public.amicable_settlements s
  where s.created_at >= v_start
    and s.created_at < v_end;

  v_mix := json_build_array(
    json_build_object('label', 'Complied', 'value', v_complied),
    json_build_object('label', 'Repudiated', 'value', v_repudiated),
    json_build_object('label', 'In execution', 'value', v_in_execution),
    json_build_object('label', 'Settlement only', 'value', v_settlement_only)
  );

  select coalesce(json_agg(row_to_json(months) order by months.month_start), '[]'::json)
  into v_monthly
  from (
    select
      month_start,
      to_char(month_start, 'Mon') as month,
      (
        select count(*)::integer
        from public.complaints c
        where (c.created_at at time zone 'Asia/Manila') >= month_start
          and (c.created_at at time zone 'Asia/Manila') < month_start + interval '1 month'
      ) as filed,
      (
        select count(*)::integer
        from public.amicable_settlements s
        where (s.created_at at time zone 'Asia/Manila') >= month_start
          and (s.created_at at time zone 'Asia/Manila') < month_start + interval '1 month'
      ) as settlements
    from generate_series(v_year_start, v_year_start + interval '11 months', interval '1 month') as month_start
  ) months;

  with candidates as (
    select
      c.id as complaint_id,
      coalesce(nullif(btrim(c.barangay_case_no), ''), '—') as case_no,
      '3-day notice overdue'::text as reason,
      '/complainants-form'::text as route,
      1 as rank,
      c.received_and_filed_at + interval '3 days' as due_at
    from public.complaints c
    left join public.notice_of_hearing n on n.complaint_id = c.id
    where c.is_received_and_filed
      and c.received_and_filed_at is not null
      and (
        (
          c.is_notice_and_summon_issued
          and n.created_at > c.received_and_filed_at + interval '3 days'
        )
        or (
          not c.is_notice_and_summon_issued
          and now() > c.received_and_filed_at + interval '3 days'
        )
      )

    union all

    select
      c.id,
      coalesce(nullif(btrim(c.barangay_case_no), ''), '—'),
      'Notice of execution due',
      '/notice-of-hearing-motion',
      2,
      n.appear_at + interval '5 days'
    from public.notices_of_hearing_motion n
    join public.motions_for_execution m on m.id = n.motion_id
    join public.complaints c on c.id = m.complaint_id
    join public.amicable_settlements s on s.complaint_id = c.id
    where s.status is distinct from 'settled'
      and s.status is distinct from 'repudiated'
      and n.appear_at < now() - interval '5 days'
      and not exists (
        select 1
        from public.notices_of_execution e
        where e.notice_motion_id = n.id
      )

    union all

    select
      c.id,
      coalesce(nullif(btrim(c.barangay_case_no), ''), '—'),
      'Summon not served',
      '/summon-for-the-respondent',
      3,
      s.issued_on
    from public.summons s
    join public.complaints c on c.id = s.complaint_id
    where s.served_on is null

    union all

    select
      c.id,
      coalesce(nullif(btrim(c.barangay_case_no), ''), '—'),
      '10-day repudiation window',
      '/amicable-settlement',
      4,
      s.created_at + interval '10 days'
    from public.amicable_settlements s
    join public.complaints c on c.id = s.complaint_id
    where s.status is null
      and now() >= s.created_at + interval '7 days'
      and now() < s.created_at + interval '10 days'

    union all

    select
      c.id,
      coalesce(nullif(btrim(c.barangay_case_no), ''), '—'),
      '6-month execution period',
      '/motion-for-execution',
      5,
      s.created_at + interval '6 months'
    from public.amicable_settlements s
    join public.complaints c on c.id = s.complaint_id
    where s.status in ('motion_for_execution', 'notice_of_hearing_motion', 'notice_of_execution')
      and s.created_at <= now() - interval '6 months'
  ),
  picked as (
    select distinct on (complaint_id)
      complaint_id,
      case_no,
      reason,
      route,
      rank,
      due_at
    from candidates
    order by complaint_id, rank, due_at
  ),
  limited as (
    select case_no, reason, route, rank, due_at
    from picked
    order by rank, due_at
    limit 8
  )
  select coalesce(
    json_agg(
      json_build_object('case_no', case_no, 'reason', reason, 'route', route)
      order by rank, due_at
    ),
    '[]'::json
  )
  into v_attention
  from limited;

  return json_build_object(
    'complaints_filed', v_complaints_filed,
    'notice_overdue', v_notice_overdue,
    'summons_unserved', v_summons_unserved,
    'settlements', v_settlements,
    'repudiated', v_repudiated,
    'complied', v_complied,
    'in_execution', v_in_execution,
    'settlement_mix', v_mix,
    'monthly', v_monthly,
    'attention', v_attention
  );
end;
$$;

revoke all on function public.get_dashboard_stats(text) from public;
grant execute on function public.get_dashboard_stats(text) to anon, authenticated;

notify pgrst, 'reload schema';
