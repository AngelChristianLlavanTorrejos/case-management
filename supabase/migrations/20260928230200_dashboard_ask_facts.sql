create or replace function public.get_dashboard_ask_facts(p_period text default 'month')
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
  v_month_start timestamptz;
  v_month_end timestamptz;
  v_start timestamptz;
  v_end timestamptz;
  v_filed integer;
  v_complied integer;
  v_repudiated integer;
  v_in_execution integer;
  v_notice json;
  v_summons json;
  v_window json;
  v_motion json;
  v_execution json;
begin
  v_month_start := date_trunc('month', v_local_now) at time zone 'Asia/Manila';
  v_month_end := (date_trunc('month', v_local_now) + interval '1 month') at time zone 'Asia/Manila';

  if v_period = 'year' then
    v_start := date_trunc('year', v_local_now) at time zone 'Asia/Manila';
    v_end := (date_trunc('year', v_local_now) + interval '1 year') at time zone 'Asia/Manila';
  else
    v_start := v_month_start;
    v_end := v_month_end;
  end if;

  select count(*)::integer
  into v_filed
  from public.complaints c
  where c.created_at >= v_month_start
    and c.created_at < v_month_end;

  select
    count(*) filter (where s.status = 'settled')::integer,
    count(*) filter (where s.status = 'repudiated')::integer,
    count(*) filter (
      where s.status in ('motion_for_execution', 'notice_of_hearing_motion', 'notice_of_execution')
    )::integer
  into v_complied, v_repudiated, v_in_execution
  from public.amicable_settlements s
  where s.created_at >= v_start
    and s.created_at < v_end;

  with notice as (
    select distinct coalesce(nullif(btrim(c.barangay_case_no), ''), '—') as case_no
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
  )
  select json_build_object(
    'total', (select count(*)::integer from notice),
    'case_nos', coalesce(
      (
        select json_agg(capped.case_no order by capped.case_no)
        from (
          select case_no
          from notice
          order by case_no
          limit 20
        ) capped
      ),
      '[]'::json
    )
  )
  into v_notice;

  with unserved as (
    select distinct coalesce(nullif(btrim(c.barangay_case_no), ''), '—') as case_no
    from public.summons s
    join public.complaints c on c.id = s.complaint_id
    where s.served_on is null
  )
  select json_build_object(
    'total', (select count(*)::integer from unserved),
    'case_nos', coalesce(
      (
        select json_agg(capped.case_no order by capped.case_no)
        from (
          select case_no
          from unserved
          order by case_no
          limit 20
        ) capped
      ),
      '[]'::json
    )
  )
  into v_summons;

  with windowed as (
    select distinct coalesce(nullif(btrim(c.barangay_case_no), ''), '—') as case_no
    from public.amicable_settlements s
    join public.complaints c on c.id = s.complaint_id
    where s.status is null
      and now() < s.created_at + interval '10 days'
  )
  select json_build_object(
    'total', (select count(*)::integer from windowed),
    'case_nos', coalesce(
      (
        select json_agg(capped.case_no order by capped.case_no)
        from (
          select case_no
          from windowed
          order by case_no
          limit 20
        ) capped
      ),
      '[]'::json
    )
  )
  into v_window;

  with ready as (
    select distinct coalesce(nullif(btrim(c.barangay_case_no), ''), '—') as case_no
    from public.complaints c
    join public.amicable_settlements s on s.complaint_id = c.id
    where s.created_at < now() - interval '10 days'
      and s.status is null
      and not exists (
        select 1
        from public.repudiations r
        where r.complaint_id = c.id
      )
      and not exists (
        select 1
        from public.motions_for_execution m
        where m.complaint_id = c.id
      )
  )
  select json_build_object(
    'total', (select count(*)::integer from ready),
    'case_nos', coalesce(
      (
        select json_agg(capped.case_no order by capped.case_no)
        from (
          select case_no
          from ready
          order by case_no
          limit 20
        ) capped
      ),
      '[]'::json
    )
  )
  into v_motion;

  with due as (
    select distinct coalesce(nullif(btrim(c.barangay_case_no), ''), '—') as case_no
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
  )
  select json_build_object(
    'total', (select count(*)::integer from due),
    'case_nos', coalesce(
      (
        select json_agg(capped.case_no order by capped.case_no)
        from (
          select case_no
          from due
          order by case_no
          limit 20
        ) capped
      ),
      '[]'::json
    )
  )
  into v_execution;

  return json_build_object(
    'complaints_filed_this_month', v_filed,
    'notice_deadline_missed', v_notice,
    'summons_unserved', v_summons,
    'repudiation_window', v_window,
    'mix', json_build_object(
      'period', v_period,
      'complied', v_complied,
      'repudiated', v_repudiated,
      'in_execution', v_in_execution
    ),
    'motion_for_execution_ready', v_motion,
    'notice_of_execution_due', v_execution
  );
end;
$$;

revoke all on function public.get_dashboard_ask_facts(text) from public;
grant execute on function public.get_dashboard_ask_facts(text) to anon, authenticated;

notify pgrst, 'reload schema';
