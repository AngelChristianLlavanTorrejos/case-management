create table public.summon_attachments (
  id bigint generated always as identity primary key,
  summon_id bigint not null references public.summons (id) on delete cascade,
  file_path text not null,
  file_name text not null,
  created_at timestamptz not null default now(),
  constraint summon_attachments_file_path_not_blank check (char_length(btrim(file_path)) > 0),
  constraint summon_attachments_file_name_not_blank check (char_length(btrim(file_name)) > 0)
);

create index summon_attachments_summon_id_idx on public.summon_attachments (summon_id);

alter table public.summon_attachments enable row level security;
revoke all on table public.summon_attachments from public, anon, authenticated;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'summons'
      and column_name = 'attachment_path'
  ) then
    insert into public.summon_attachments (summon_id, file_path, file_name)
    select
      s.id,
      s.attachment_path,
      coalesce(nullif(split_part(s.attachment_path, '/', 2), ''), s.attachment_path)
    from public.summons s
    where s.attachment_path is not null
      and btrim(s.attachment_path) <> '';

    alter table public.summons
      drop column attachment_path;
  end if;
end
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
    'attachments', coalesce(
      (
        select json_agg(
          json_build_object(
            'id', a.id,
            'file_path', a.file_path,
            'file_name', a.file_name
          )
          order by a.id
        )
        from public.summon_attachments a
        where a.summon_id = s.id
      ),
      '[]'::json
    )
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

drop function if exists public.update_summon(bigint, bigint, timestamptz, date, text, text, text, text);

create or replace function public.update_summon(
  p_id bigint,
  p_actor_user_id bigint,
  p_appear_at timestamptz,
  p_served_on date default null,
  p_dwelling_recipient text default null,
  p_office_recipient text default null,
  p_officer_in_charge text default null
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
    officer_in_charge = nullif(btrim(coalesce(p_officer_in_charge, '')), '')
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

create or replace function public.add_summon_attachment(
  p_summon_id bigint,
  p_actor_user_id bigint,
  p_file_path text,
  p_file_name text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_path text := btrim(coalesce(p_file_path, ''));
  v_name text := btrim(coalesce(p_file_name, ''));
begin
  perform public.require_activity_actor(p_actor_user_id);

  if not exists (select 1 from public.summons where id = p_summon_id) then
    raise exception 'Summon not found';
  end if;

  if v_path = '' or v_name = '' then
    raise exception 'Attachment is required.';
  end if;

  insert into public.summon_attachments (summon_id, file_path, file_name)
  values (p_summon_id, v_path, v_name)
  returning id into v_id;

  return json_build_object('ok', true, 'id', v_id);
end;
$$;

create or replace function public.delete_summon_attachment(
  p_id bigint,
  p_actor_user_id bigint
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_path text;
begin
  perform public.require_activity_actor(p_actor_user_id);

  select file_path into v_path
  from public.summon_attachments
  where id = p_id;

  if not found then
    raise exception 'Attachment not found';
  end if;

  delete from public.summon_attachments
  where id = p_id;

  return json_build_object('ok', true, 'id', p_id, 'file_path', v_path);
end;
$$;

revoke all on function public.get_summon(bigint) from public;
grant execute on function public.get_summon(bigint) to anon, authenticated;

revoke all on function public.update_summon(bigint, bigint, timestamptz, date, text, text, text) from public;
grant execute on function public.update_summon(bigint, bigint, timestamptz, date, text, text, text) to anon, authenticated;

revoke all on function public.add_summon_attachment(bigint, bigint, text, text) from public;
grant execute on function public.add_summon_attachment(bigint, bigint, text, text) to anon, authenticated;

revoke all on function public.delete_summon_attachment(bigint, bigint) from public;
grant execute on function public.delete_summon_attachment(bigint, bigint) to anon, authenticated;

notify pgrst, 'reload schema';
