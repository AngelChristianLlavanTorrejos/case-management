-- In-app notifications. The table is not exposed to the Data API.
-- List and read go through security-definer RPCs that take the actor id.

create table public.notifications (
  id bigint generated always as identity primary key,
  recipient_user_id bigint not null references public.users (id) on delete cascade,
  title text not null,
  body text not null,
  path text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_title_not_blank check (char_length(btrim(title)) > 0),
  constraint notifications_body_not_blank check (char_length(btrim(body)) > 0)
);

create index notifications_recipient_created_idx
  on public.notifications (recipient_user_id, created_at desc);

create index notifications_recipient_unread_idx
  on public.notifications (recipient_user_id)
  where read_at is null;

alter table public.notifications enable row level security;
revoke all on table public.notifications from public, anon, authenticated;

create or replace function public.notification_staff_ids()
returns bigint[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(u.id), array[]::bigint[])
  from public.users u
  join public.roles r on r.id = u.role_id
  where r.name in ('Super Admin', 'Admin');
$$;

revoke all on function public.notification_staff_ids() from public;

create or replace function public.notification_actor_from_log(p_key text, p_id bigint)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select l.user_id
  from public.user_activity_logs l
  where l.new_value ->> p_key = p_id::text
  order by l.id desc
  limit 1;
$$;

revoke all on function public.notification_actor_from_log(text, bigint) from public;

create or replace function public.notify_users(
  p_recipient_ids bigint[],
  p_exclude_user_id bigint,
  p_title text,
  p_body text,
  p_path text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  for v_id in
    select distinct recipient_id
    from unnest(coalesce(p_recipient_ids, array[]::bigint[])) as recipient_id
    where recipient_id is not null
      and (p_exclude_user_id is null or recipient_id <> p_exclude_user_id)
      and exists (select 1 from public.users u where u.id = recipient_id)
  loop
    insert into public.notifications (recipient_user_id, title, body, path)
    values (v_id, p_title, p_body, p_path);

    begin
      perform realtime.send(
        jsonb_build_object('user_id', v_id),
        'notification',
        'notifications:' || v_id::text,
        false
      );
    exception
      when others then
        null;
    end;
  end loop;
end;
$$;

revoke all on function public.notify_users(bigint[], bigint, text, text, text) from public;

create or replace function public.notify_complaint_inserted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_users(
    public.notification_staff_ids(),
    new.user_id,
    'New complaint',
    'A new complaint was filed.',
    '/complainants-form/' || new.id::text || '/view'
  );
  return new;
end;
$$;

revoke all on function public.notify_complaint_inserted() from public;

create trigger notifications_complaint_insert
after insert on public.complaints
for each row
execute function public.notify_complaint_inserted();

create or replace function public.notify_complaint_received()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case text := nullif(btrim(coalesce(new.barangay_case_no, '')), '');
begin
  perform public.notify_users(
    array[new.user_id],
    null,
    'Received and filed',
    case
      when v_case is null then 'Your complaint is now received and filed.'
      else format('Case %s is now received and filed.', v_case)
    end,
    '/complainants-form/' || new.id::text || '/view'
  );
  return new;
end;
$$;

revoke all on function public.notify_complaint_received() from public;

create trigger notifications_complaint_received
after update of is_received_and_filed on public.complaints
for each row
when (old.is_received_and_filed = false and new.is_received_and_filed = true)
execute function public.notify_complaint_received();

create or replace function public.notify_notice_issued()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner bigint;
  v_case text;
begin
  select c.user_id, nullif(btrim(coalesce(c.barangay_case_no, '')), '')
  into v_owner, v_case
  from public.complaints c
  where c.id = new.complaint_id;

  if v_owner is null then
    return new;
  end if;

  perform public.notify_users(
    array[v_owner],
    null,
    'Notice of Hearing',
    case
      when v_case is null then 'A notice of hearing was issued.'
      else format('A notice of hearing was issued for case %s.', v_case)
    end,
    '/notice-of-hearing'
  );
  return new;
end;
$$;

revoke all on function public.notify_notice_issued() from public;

create trigger notifications_notice_insert
after insert on public.notice_of_hearing
for each row
execute function public.notify_notice_issued();

create or replace function public.notify_notice_acknowledged()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case text;
begin
  select nullif(btrim(coalesce(c.barangay_case_no, '')), '')
  into v_case
  from public.complaints c
  where c.id = new.complaint_id;

  perform public.notify_users(
    public.notification_staff_ids(),
    null,
    'Notice acknowledged',
    case
      when v_case is null then 'A notice of hearing was acknowledged.'
      else format('The notice of hearing for case %s was acknowledged.', v_case)
    end,
    '/notice-of-hearing'
  );
  return new;
end;
$$;

revoke all on function public.notify_notice_acknowledged() from public;

create trigger notifications_notice_acknowledged
after update of acknowledged_on on public.notice_of_hearing
for each row
when (old.acknowledged_on is null and new.acknowledged_on is not null)
execute function public.notify_notice_acknowledged();

create or replace function public.notify_summon_issued()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case text;
  v_actor bigint;
begin
  select nullif(btrim(coalesce(c.barangay_case_no, '')), '')
  into v_case
  from public.complaints c
  where c.id = new.complaint_id;

  v_actor := public.notification_actor_from_log('summon_id', new.id);

  perform public.notify_users(
    public.notification_staff_ids(),
    v_actor,
    'Summon issued',
    case
      when v_case is null then 'A summon was issued.'
      else format('A summon was issued for case %s.', v_case)
    end,
    '/summon-for-the-respondent'
  );
  return null;
end;
$$;

revoke all on function public.notify_summon_issued() from public;

create constraint trigger notifications_summon_insert
after insert on public.summons
deferrable initially deferred
for each row
execute function public.notify_summon_issued();

create or replace function public.notify_settlement_recorded()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner bigint;
  v_case text;
  v_actor bigint;
begin
  select c.user_id, nullif(btrim(coalesce(c.barangay_case_no, '')), '')
  into v_owner, v_case
  from public.complaints c
  where c.id = new.complaint_id;

  v_actor := public.notification_actor_from_log('settlement_id', new.id);

  perform public.notify_users(
    public.notification_staff_ids() || array[v_owner],
    v_actor,
    'Amicable settlement',
    case
      when v_case is null then 'An amicable settlement was recorded.'
      else format('An amicable settlement was recorded for case %s.', v_case)
    end,
    '/amicable-settlement'
  );
  return null;
end;
$$;

revoke all on function public.notify_settlement_recorded() from public;

create constraint trigger notifications_settlement_insert
after insert on public.amicable_settlements
deferrable initially deferred
for each row
execute function public.notify_settlement_recorded();

create or replace function public.notify_repudiation_recorded()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner bigint;
  v_case text;
  v_actor bigint;
begin
  select c.user_id, nullif(btrim(coalesce(c.barangay_case_no, '')), '')
  into v_owner, v_case
  from public.complaints c
  where c.id = new.complaint_id;

  v_actor := public.notification_actor_from_log('repudiation_id', new.id);

  perform public.notify_users(
    public.notification_staff_ids() || array[v_owner],
    v_actor,
    'Repudiation',
    case
      when v_case is null then 'A repudiation was recorded.'
      else format('A repudiation was recorded for case %s.', v_case)
    end,
    '/repudiation'
  );
  return null;
end;
$$;

revoke all on function public.notify_repudiation_recorded() from public;

create constraint trigger notifications_repudiation_insert
after insert on public.repudiations
deferrable initially deferred
for each row
execute function public.notify_repudiation_recorded();

create or replace function public.list_notifications(p_actor_user_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unread integer;
  v_items json;
begin
  perform public.require_activity_actor(p_actor_user_id);

  select count(*)::integer
  into v_unread
  from public.notifications n
  where n.recipient_user_id = p_actor_user_id
    and n.read_at is null;

  select coalesce(json_agg(row_to_json(t)), '[]'::json)
  into v_items
  from (
    select n.id, n.title, n.body, n.path, n.read_at, n.created_at
    from public.notifications n
    where n.recipient_user_id = p_actor_user_id
    order by n.created_at desc, n.id desc
    limit 30
  ) t;

  return json_build_object('unread_count', v_unread, 'items', v_items);
end;
$$;

revoke all on function public.list_notifications(bigint) from public;
grant execute on function public.list_notifications(bigint) to anon, authenticated;

create or replace function public.mark_notification_read(
  p_id bigint,
  p_actor_user_id bigint
)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_activity_actor(p_actor_user_id);

  if not exists (
    select 1
    from public.notifications n
    where n.id = p_id
      and n.recipient_user_id = p_actor_user_id
  ) then
    raise exception 'Notification not found';
  end if;

  update public.notifications
  set read_at = coalesce(read_at, now())
  where id = p_id
    and recipient_user_id = p_actor_user_id;

  return json_build_object('ok', true);
end;
$$;

revoke all on function public.mark_notification_read(bigint, bigint) from public;
grant execute on function public.mark_notification_read(bigint, bigint) to anon, authenticated;

create or replace function public.mark_all_notifications_read(p_actor_user_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_activity_actor(p_actor_user_id);

  update public.notifications
  set read_at = now()
  where recipient_user_id = p_actor_user_id
    and read_at is null;

  return json_build_object('ok', true);
end;
$$;

revoke all on function public.mark_all_notifications_read(bigint) from public;
grant execute on function public.mark_all_notifications_read(bigint) to anon, authenticated;

notify pgrst, 'reload schema';
