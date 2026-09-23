create table public.complaint_types (
  id bigint generated always as identity primary key,
  name text not null,
  can_delete boolean not null default true,
  constraint complaint_types_name_not_blank check (char_length(trim(name)) > 0),
  constraint complaint_types_name_unique unique (name)
);

insert into public.complaint_types (name, can_delete)
values
  ('Property Dispute', false),
  ('Boundary Dispute', false),
  ('Collection of Debt / Money', false),
  ('Damage to Property', false),
  ('Physical Injury', false),
  ('Threats', false),
  ('Harassment', false),
  ('Unjust Vexation', false),
  ('Theft', false),
  ('Noise / Disturbance', false),
  ('Trespassing', false),
  ('Verbal Abuse', false),
  ('Family Dispute', false),
  ('Neighbor Dispute', false),
  ('Other Civil Dispute', false);

create trigger complaint_types_prevent_locked_delete
before delete on public.complaint_types
for each row
execute function public.prevent_locked_reference_delete();

alter table public.complaint_types enable row level security;

create policy complaint_types_select_public
on public.complaint_types
for select
to anon, authenticated
using (true);

grant select on table public.complaint_types to anon, authenticated;

insert into public.menus (parent_id, name, icon, path, sort_order, is_active)
select m.id, 'Complaint Types', 'Scale', '/masterfile/complaint-types', 3, true
from public.menus m
where m.name = 'Masterfile' and m.parent_id is null
  and not exists (
    select 1 from public.menus where path = '/masterfile/complaint-types'
  );

alter table public.complaints
  add column complaint_type_id bigint references public.complaint_types (id) on delete restrict;

create index complaints_complaint_type_id_idx on public.complaints (complaint_type_id);

do $$
begin
  if not exists (select 1 from public.complaints where complaint_type_id is null) then
    alter table public.complaints
      alter column complaint_type_id set not null;
  end if;
end $$;

drop function if exists public.create_complaint(bigint, text[], text[], text, text);

create or replace function public.create_complaint_type(p_name text, p_actor_user_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(p_name);
  v_row public.complaint_types%rowtype;
  v_actor_name text;
begin
  perform public.require_activity_actor(p_actor_user_id);

  if v_name is null or char_length(v_name) = 0 then
    raise exception 'Name is required';
  end if;

  if exists (select 1 from public.complaint_types where lower(name) = lower(v_name)) then
    raise exception 'Complaint type "%" already exists', v_name;
  end if;

  insert into public.complaint_types (name)
  values (v_name)
  returning * into v_row;

  v_actor_name := public.user_display_name(p_actor_user_id);

  perform public.write_user_activity_log(
    p_actor_user_id,
    'add',
    public.menu_id_by_path('/masterfile/complaint-types'),
    format('%s added complaint type "%s".', v_actor_name, v_row.name),
    null,
    to_jsonb(v_row)
  );

  return to_json(v_row);
end;
$$;

create or replace function public.update_complaint_type(p_id bigint, p_name text, p_actor_user_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(p_name);
  v_old public.complaint_types%rowtype;
  v_row public.complaint_types%rowtype;
  v_actor_name text;
begin
  perform public.require_activity_actor(p_actor_user_id);

  if v_name is null or char_length(v_name) = 0 then
    raise exception 'Name is required';
  end if;

  select * into v_old from public.complaint_types where id = p_id;
  if not found then
    raise exception 'Complaint type not found';
  end if;

  if v_old.can_delete is false then
    raise exception 'System value "%" cannot be edited', v_old.name;
  end if;

  if exists (
    select 1 from public.complaint_types
    where lower(name) = lower(v_name) and id is distinct from p_id
  ) then
    raise exception 'Complaint type "%" already exists', v_name;
  end if;

  update public.complaint_types
  set name = v_name
  where id = p_id
  returning * into v_row;

  v_actor_name := public.user_display_name(p_actor_user_id);

  perform public.write_user_activity_log(
    p_actor_user_id,
    'edit',
    public.menu_id_by_path('/masterfile/complaint-types'),
    format('%s changed complaint type "%s" to "%s".', v_actor_name, v_old.name, v_row.name),
    to_jsonb(v_old),
    to_jsonb(v_row)
  );

  return to_json(v_row);
end;
$$;

create or replace function public.delete_complaint_type(p_id bigint, p_actor_user_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.complaint_types%rowtype;
  v_actor_name text;
begin
  perform public.require_activity_actor(p_actor_user_id);

  select * into v_row from public.complaint_types where id = p_id;
  if not found then
    raise exception 'Complaint type not found';
  end if;

  begin
    delete from public.complaint_types where id = p_id;
  exception
    when foreign_key_violation then
      raise exception 'Complaint type "%" is in use and cannot be deleted', v_row.name;
  end;

  v_actor_name := public.user_display_name(p_actor_user_id);

  perform public.write_user_activity_log(
    p_actor_user_id,
    'delete',
    public.menu_id_by_path('/masterfile/complaint-types'),
    format('%s deleted complaint type "%s".', v_actor_name, v_row.name),
    to_jsonb(v_row),
    null
  );

  return json_build_object('ok', true, 'id', p_id);
end;
$$;

create or replace function public.create_complaint(
  p_actor_user_id bigint,
  p_complaint_type_id bigint,
  p_complainants text[],
  p_respondents text[],
  p_manner text,
  p_relief text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_complaint_id bigint;
  v_actor_name text;
  v_type_name text;
  v_complainants text[];
  v_respondents text[];
  v_manner text := btrim(coalesce(p_manner, ''));
  v_relief text := btrim(coalesce(p_relief, ''));
  v_name text;
  v_index integer;
begin
  perform public.require_activity_actor(p_actor_user_id);

  select name into v_type_name
  from public.complaint_types
  where id = p_complaint_type_id;

  if not found then
    raise exception 'Complaint type is required.';
  end if;

  select array_agg(btrim(value) order by ordinality)
  into v_complainants
  from unnest(coalesce(p_complainants, array[]::text[])) with ordinality as t(value, ordinality)
  where char_length(btrim(value)) > 0;

  select array_agg(btrim(value) order by ordinality)
  into v_respondents
  from unnest(coalesce(p_respondents, array[]::text[])) with ordinality as t(value, ordinality)
  where char_length(btrim(value)) > 0;

  if coalesce(array_length(v_complainants, 1), 0) < 1 then
    raise exception 'Add at least one complainant.';
  end if;

  if coalesce(array_length(v_respondents, 1), 0) < 1 then
    raise exception 'Add at least one respondent.';
  end if;

  if char_length(v_manner) = 0 then
    raise exception 'Describe how your rights and interests were violated.';
  end if;

  if char_length(v_relief) = 0 then
    raise exception 'Describe the relief you are praying for.';
  end if;

  insert into public.complaints (user_id, complaint_type_id, manner, relief)
  values (p_actor_user_id, p_complaint_type_id, v_manner, v_relief)
  returning id into v_complaint_id;

  v_index := 0;
  foreach v_name in array v_complainants loop
    v_index := v_index + 1;
    insert into public.complaint_parties (complaint_id, party_type, name, sort_order)
    values (v_complaint_id, 'complainant', v_name, v_index);
  end loop;

  v_index := 0;
  foreach v_name in array v_respondents loop
    v_index := v_index + 1;
    insert into public.complaint_parties (complaint_id, party_type, name, sort_order)
    values (v_complaint_id, 'respondent', v_name, v_index);
  end loop;

  v_actor_name := public.user_display_name(p_actor_user_id);

  perform public.write_user_activity_log(
    p_actor_user_id,
    'add',
    public.menu_id_by_path('/complainants-form'),
    format('%s submitted a complainant''s form (%s).', v_actor_name, v_type_name),
    null,
    jsonb_build_object(
      'id', v_complaint_id,
      'complaint_type_id', p_complaint_type_id,
      'complaint_type', v_type_name,
      'complainants', to_jsonb(v_complainants),
      'respondents', to_jsonb(v_respondents),
      'manner', v_manner,
      'relief', v_relief
    )
  );

  return json_build_object('ok', true, 'id', v_complaint_id);
end;
$$;

revoke all on function public.create_complaint_type(text, bigint) from public;
revoke all on function public.update_complaint_type(bigint, text, bigint) from public;
revoke all on function public.delete_complaint_type(bigint, bigint) from public;
revoke all on function public.create_complaint(bigint, bigint, text[], text[], text, text) from public;

grant execute on function public.create_complaint_type(text, bigint) to anon, authenticated;
grant execute on function public.update_complaint_type(bigint, text, bigint) to anon, authenticated;
grant execute on function public.delete_complaint_type(bigint, bigint) to anon, authenticated;
grant execute on function public.create_complaint(bigint, bigint, text[], text[], text, text) to anon, authenticated;

notify pgrst, 'reload schema';
