alter table public.complaints
  add column is_notice_and_summon_issued boolean not null default false;

create table public.notice_of_hearing (
  id bigint generated always as identity primary key,
  complaint_id bigint not null unique references public.complaints (id) on delete cascade,
  appear_at timestamptz not null,
  issued_on date not null default current_date,
  acknowledged_on date,
  created_at timestamptz not null default now()
);

create table public.summons (
  id bigint generated always as identity primary key,
  complaint_id bigint not null unique references public.complaints (id) on delete cascade,
  appear_at timestamptz not null,
  issued_on date not null default current_date,
  served_on date,
  dwelling_recipient text,
  office_recipient text,
  officer_in_charge text,
  attachment_path text,
  created_at timestamptz not null default now()
);

create index notice_of_hearing_appear_at_idx on public.notice_of_hearing (appear_at desc);
create index summons_appear_at_idx on public.summons (appear_at desc);

alter table public.notice_of_hearing enable row level security;
alter table public.summons enable row level security;
revoke all on table public.notice_of_hearing from public, anon, authenticated;
revoke all on table public.summons from public, anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'summon-attachments',
  'summon-attachments',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists summon_attachments_insert on storage.objects;
drop policy if exists summon_attachments_select on storage.objects;
drop policy if exists summon_attachments_update on storage.objects;
drop policy if exists summon_attachments_delete on storage.objects;

create policy summon_attachments_insert
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'summon-attachments');

create policy summon_attachments_select
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'summon-attachments');

create policy summon_attachments_update
on storage.objects
for update
to anon, authenticated
using (bucket_id = 'summon-attachments')
with check (bucket_id = 'summon-attachments');

create policy summon_attachments_delete
on storage.objects
for delete
to anon, authenticated
using (bucket_id = 'summon-attachments');

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
      c.is_notice_and_summon_issued
    from public.complaints c
    left join public.complaint_types ct on ct.id = c.complaint_type_id
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
      is_notice_and_summon_issued
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
    'is_notice_and_summon_issued', c.is_notice_and_summon_issued,
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

create or replace function public.issue_notice_and_summon(
  p_complaint_id bigint,
  p_actor_user_id bigint,
  p_appear_at timestamptz,
  p_officer_in_charge text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_filed boolean;
  v_issued boolean;
  v_case_no text;
  v_officer text;
  v_issued_on date;
  v_notice_id bigint;
  v_summon_id bigint;
  v_actor_name text;
begin
  perform public.require_activity_actor(p_actor_user_id);

  if p_appear_at is null then
    raise exception 'Appear on is required.';
  end if;

  select c.is_received_and_filed, c.is_notice_and_summon_issued, c.barangay_case_no
  into v_filed, v_issued, v_case_no
  from public.complaints c
  where c.id = p_complaint_id;

  if not found then
    raise exception 'Complaint not found';
  end if;

  if not v_filed or v_case_no is null then
    raise exception 'This complaint must be received and filed first.';
  end if;

  if v_issued then
    raise exception 'Notice of hearing and summon were already issued.';
  end if;

  v_officer := nullif(btrim(coalesce(p_officer_in_charge, '')), '');
  v_issued_on := current_date;

  insert into public.notice_of_hearing (complaint_id, appear_at, issued_on)
  values (p_complaint_id, p_appear_at, v_issued_on)
  returning id into v_notice_id;

  insert into public.summons (complaint_id, appear_at, issued_on, officer_in_charge)
  values (p_complaint_id, p_appear_at, v_issued_on, v_officer)
  returning id into v_summon_id;

  update public.complaints
  set is_notice_and_summon_issued = true
  where id = p_complaint_id;

  v_actor_name := public.user_display_name(p_actor_user_id);

  perform public.write_user_activity_log(
    p_actor_user_id,
    'add',
    public.menu_id_by_path('/complainants-form'),
    format('%s issued a notice of hearing and summon (%s).', v_actor_name, v_case_no),
    null,
    jsonb_build_object(
      'complaint_id', p_complaint_id,
      'barangay_case_no', v_case_no,
      'notice_id', v_notice_id,
      'summon_id', v_summon_id,
      'appear_at', p_appear_at,
      'issued_on', v_issued_on,
      'officer_in_charge', v_officer
    )
  );

  return json_build_object('ok', true, 'notice_id', v_notice_id, 'summon_id', v_summon_id);
end;
$$;

create or replace function public.list_notices_of_hearing(
  p_search text default '',
  p_sort_key text default 'issued_on',
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
      n.id,
      n.complaint_id,
      c.barangay_case_no,
      coalesce(
        (
          select string_agg(p.name, ', ' order by p.sort_order)
          from public.complaint_parties p
          where p.complaint_id = c.id and p.party_type = 'complainant'
        ),
        ''
      ) as complainants,
      n.appear_at,
      n.issued_on,
      n.acknowledged_on,
      case when n.acknowledged_on is null then 'Pending' else 'Acknowledged' end as status
    from public.notice_of_hearing n
    join public.complaints c on c.id = n.complaint_id
  ),
  filtered as (
    select *
    from base
    where v_search = ''
       or lower(coalesce(barangay_case_no, '')) like '%' || v_search || '%'
       or lower(complainants) like '%' || v_search || '%'
  ),
  counted as (
    select count(*)::integer as total from filtered
  ),
  paged as (
    select *
    from filtered
    order by
      case when p_sort_key = 'barangay_case_no' and p_sort_dir = 'asc' then barangay_case_no end asc,
      case when p_sort_key = 'barangay_case_no' and p_sort_dir = 'desc' then barangay_case_no end desc,
      case when p_sort_key = 'complainants' and p_sort_dir = 'asc' then complainants end asc,
      case when p_sort_key = 'complainants' and p_sort_dir = 'desc' then complainants end desc,
      case when p_sort_key = 'appear_at' and p_sort_dir = 'asc' then appear_at end asc,
      case when p_sort_key = 'appear_at' and p_sort_dir = 'desc' then appear_at end desc,
      case when p_sort_key = 'issued_on' and p_sort_dir = 'asc' then issued_on end asc,
      case when p_sort_key = 'issued_on' and p_sort_dir = 'desc' then issued_on end desc,
      case when p_sort_key = 'acknowledged_on' and p_sort_dir = 'asc' then acknowledged_on end asc,
      case when p_sort_key = 'acknowledged_on' and p_sort_dir = 'desc' then acknowledged_on end desc,
      case when p_sort_key = 'status' and p_sort_dir = 'asc' then status end asc,
      case when p_sort_key = 'status' and p_sort_dir = 'desc' then status end desc,
      issued_on desc,
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

create or replace function public.get_notice_of_hearing(p_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  select json_build_object(
    'id', n.id,
    'complaint_id', n.complaint_id,
    'barangay_case_no', c.barangay_case_no,
    'complainants', coalesce(
      (
        select string_agg(p.name, ', ' order by p.sort_order)
        from public.complaint_parties p
        where p.complaint_id = c.id and p.party_type = 'complainant'
      ),
      ''
    ),
    'appear_at', n.appear_at,
    'issued_on', n.issued_on,
    'acknowledged_on', n.acknowledged_on,
    'status', case when n.acknowledged_on is null then 'Pending' else 'Acknowledged' end
  )
  into v_result
  from public.notice_of_hearing n
  join public.complaints c on c.id = n.complaint_id
  where n.id = p_id;

  if v_result is null then
    raise exception 'Notice of hearing not found';
  end if;

  return v_result;
end;
$$;

create or replace function public.update_notice_of_hearing(
  p_id bigint,
  p_actor_user_id bigint,
  p_appear_at timestamptz,
  p_acknowledged_on date default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_case_no text;
  v_actor_name text;
begin
  perform public.require_activity_actor(p_actor_user_id);

  if p_appear_at is null then
    raise exception 'Appear on is required.';
  end if;

  select public.get_notice_of_hearing(p_id)::jsonb, c.barangay_case_no
  into v_old, v_case_no
  from public.notice_of_hearing n
  join public.complaints c on c.id = n.complaint_id
  where n.id = p_id;

  if not found then
    raise exception 'Notice of hearing not found';
  end if;

  update public.notice_of_hearing
  set
    appear_at = p_appear_at,
    acknowledged_on = p_acknowledged_on
  where id = p_id;

  v_actor_name := public.user_display_name(p_actor_user_id);

  perform public.write_user_activity_log(
    p_actor_user_id,
    'edit',
    public.menu_id_by_path('/notice-of-hearing'),
    format('%s updated a notice of hearing (%s).', v_actor_name, coalesce(v_case_no, '—')),
    v_old,
    public.get_notice_of_hearing(p_id)::jsonb
  );

  return json_build_object('ok', true, 'id', p_id);
end;
$$;

create or replace function public.list_summons(
  p_search text default '',
  p_sort_key text default 'issued_on',
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
      s.id,
      s.complaint_id,
      c.barangay_case_no,
      coalesce(
        (
          select string_agg(p.name, ', ' order by p.sort_order)
          from public.complaint_parties p
          where p.complaint_id = c.id and p.party_type = 'respondent'
        ),
        ''
      ) as respondents,
      s.appear_at,
      s.issued_on,
      s.served_on,
      s.officer_in_charge
    from public.summons s
    join public.complaints c on c.id = s.complaint_id
  ),
  filtered as (
    select *
    from base
    where v_search = ''
       or lower(coalesce(barangay_case_no, '')) like '%' || v_search || '%'
       or lower(respondents) like '%' || v_search || '%'
       or lower(coalesce(officer_in_charge, '')) like '%' || v_search || '%'
  ),
  counted as (
    select count(*)::integer as total from filtered
  ),
  paged as (
    select *
    from filtered
    order by
      case when p_sort_key = 'barangay_case_no' and p_sort_dir = 'asc' then barangay_case_no end asc,
      case when p_sort_key = 'barangay_case_no' and p_sort_dir = 'desc' then barangay_case_no end desc,
      case when p_sort_key = 'respondents' and p_sort_dir = 'asc' then respondents end asc,
      case when p_sort_key = 'respondents' and p_sort_dir = 'desc' then respondents end desc,
      case when p_sort_key = 'appear_at' and p_sort_dir = 'asc' then appear_at end asc,
      case when p_sort_key = 'appear_at' and p_sort_dir = 'desc' then appear_at end desc,
      case when p_sort_key = 'issued_on' and p_sort_dir = 'asc' then issued_on end asc,
      case when p_sort_key = 'issued_on' and p_sort_dir = 'desc' then issued_on end desc,
      case when p_sort_key = 'served_on' and p_sort_dir = 'asc' then served_on end asc,
      case when p_sort_key = 'served_on' and p_sort_dir = 'desc' then served_on end desc,
      case when p_sort_key = 'officer_in_charge' and p_sort_dir = 'asc' then officer_in_charge end asc,
      case when p_sort_key = 'officer_in_charge' and p_sort_dir = 'desc' then officer_in_charge end desc,
      issued_on desc,
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

create or replace function public.get_summon(p_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  select json_build_object(
    'id', s.id,
    'complaint_id', s.complaint_id,
    'barangay_case_no', c.barangay_case_no,
    'respondents', coalesce(
      (
        select string_agg(p.name, ', ' order by p.sort_order)
        from public.complaint_parties p
        where p.complaint_id = c.id and p.party_type = 'respondent'
      ),
      ''
    ),
    'appear_at', s.appear_at,
    'issued_on', s.issued_on,
    'served_on', s.served_on,
    'dwelling_recipient', s.dwelling_recipient,
    'office_recipient', s.office_recipient,
    'officer_in_charge', s.officer_in_charge,
    'attachment_path', s.attachment_path
  )
  into v_result
  from public.summons s
  join public.complaints c on c.id = s.complaint_id
  where s.id = p_id;

  if v_result is null then
    raise exception 'Summon not found';
  end if;

  return v_result;
end;
$$;

create or replace function public.update_summon(
  p_id bigint,
  p_actor_user_id bigint,
  p_appear_at timestamptz,
  p_served_on date default null,
  p_dwelling_recipient text default null,
  p_office_recipient text default null,
  p_officer_in_charge text default null,
  p_attachment_path text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_case_no text;
  v_actor_name text;
begin
  perform public.require_activity_actor(p_actor_user_id);

  if p_appear_at is null then
    raise exception 'Appear on is required.';
  end if;

  select public.get_summon(p_id)::jsonb, c.barangay_case_no
  into v_old, v_case_no
  from public.summons s
  join public.complaints c on c.id = s.complaint_id
  where s.id = p_id;

  if not found then
    raise exception 'Summon not found';
  end if;

  update public.summons
  set
    appear_at = p_appear_at,
    served_on = p_served_on,
    dwelling_recipient = nullif(btrim(coalesce(p_dwelling_recipient, '')), ''),
    office_recipient = nullif(btrim(coalesce(p_office_recipient, '')), ''),
    officer_in_charge = nullif(btrim(coalesce(p_officer_in_charge, '')), ''),
    attachment_path = case
      when p_attachment_path is null then attachment_path
      when btrim(p_attachment_path) = '' then null
      else btrim(p_attachment_path)
    end
  where id = p_id;

  v_actor_name := public.user_display_name(p_actor_user_id);

  perform public.write_user_activity_log(
    p_actor_user_id,
    'edit',
    public.menu_id_by_path('/summon-for-the-respondent'),
    format('%s updated a summon (%s).', v_actor_name, coalesce(v_case_no, '—')),
    v_old,
    public.get_summon(p_id)::jsonb
  );

  return json_build_object('ok', true, 'id', p_id);
end;
$$;

revoke all on function public.list_complaints(text, text, text, integer, integer) from public;
grant execute on function public.list_complaints(text, text, text, integer, integer) to anon, authenticated;

revoke all on function public.get_complaint(bigint) from public;
grant execute on function public.get_complaint(bigint) to anon, authenticated;

revoke all on function public.issue_notice_and_summon(bigint, bigint, timestamptz, text) from public;
grant execute on function public.issue_notice_and_summon(bigint, bigint, timestamptz, text) to anon, authenticated;

revoke all on function public.list_notices_of_hearing(text, text, text, integer, integer) from public;
grant execute on function public.list_notices_of_hearing(text, text, text, integer, integer) to anon, authenticated;

revoke all on function public.get_notice_of_hearing(bigint) from public;
grant execute on function public.get_notice_of_hearing(bigint) to anon, authenticated;

revoke all on function public.update_notice_of_hearing(bigint, bigint, timestamptz, date) from public;
grant execute on function public.update_notice_of_hearing(bigint, bigint, timestamptz, date) to anon, authenticated;

revoke all on function public.list_summons(text, text, text, integer, integer) from public;
grant execute on function public.list_summons(text, text, text, integer, integer) to anon, authenticated;

revoke all on function public.get_summon(bigint) from public;
grant execute on function public.get_summon(bigint) to anon, authenticated;

revoke all on function public.update_summon(bigint, bigint, timestamptz, date, text, text, text, text) from public;
grant execute on function public.update_summon(bigint, bigint, timestamptz, date, text, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
