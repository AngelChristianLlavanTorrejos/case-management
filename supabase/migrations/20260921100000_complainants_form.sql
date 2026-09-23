create table public.complaints (
  id bigint generated always as identity primary key,
  user_id bigint not null references public.users (id) on delete restrict,
  manner text not null,
  relief text not null,
  created_at timestamptz not null default now(),
  constraint complaints_manner_not_blank check (char_length(btrim(manner)) > 0),
  constraint complaints_relief_not_blank check (char_length(btrim(relief)) > 0)
);

create index complaints_user_id_idx on public.complaints (user_id);
create index complaints_created_at_idx on public.complaints (created_at desc);

create table public.complaint_parties (
  id bigint generated always as identity primary key,
  complaint_id bigint not null references public.complaints (id) on delete cascade,
  party_type text not null,
  name text not null,
  sort_order integer not null default 0,
  constraint complaint_parties_type_check check (party_type in ('complainant', 'respondent')),
  constraint complaint_parties_name_not_blank check (char_length(btrim(name)) > 0)
);

create index complaint_parties_complaint_id_idx on public.complaint_parties (complaint_id);

alter table public.complaints enable row level security;
alter table public.complaint_parties enable row level security;
revoke all on table public.complaints from public, anon, authenticated;
revoke all on table public.complaint_parties from public, anon, authenticated;

insert into public.menus (parent_id, name, icon, path, sort_order, is_active)
select null, 'Complainant''s Form', 'FileText', '/complainants-form', 3, true
where not exists (
  select 1 from public.menus where path = '/complainants-form'
);

update public.menus
set sort_order = 4
where name = 'Masterfile' and parent_id is null and sort_order < 4;

update public.menus
set sort_order = 5
where name = 'User Activity Log' and parent_id is null;

update public.menus
set sort_order = 6
where name = 'Baseline Security' and parent_id is null;

update public.menus
set sort_order = 7
where name = 'My Profile' and parent_id is null;

update public.menus
set sort_order = 8
where name = 'Change Password' and parent_id is null;

create or replace function public.create_complaint(
  p_actor_user_id bigint,
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
  v_complainants text[];
  v_respondents text[];
  v_manner text := btrim(coalesce(p_manner, ''));
  v_relief text := btrim(coalesce(p_relief, ''));
  v_name text;
  v_index integer;
begin
  perform public.require_activity_actor(p_actor_user_id);

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

  insert into public.complaints (user_id, manner, relief)
  values (p_actor_user_id, v_manner, v_relief)
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
    format('%s submitted a complainant''s form.', v_actor_name),
    null,
    jsonb_build_object(
      'id', v_complaint_id,
      'complainants', to_jsonb(v_complainants),
      'respondents', to_jsonb(v_respondents),
      'manner', v_manner,
      'relief', v_relief
    )
  );

  return json_build_object('ok', true, 'id', v_complaint_id);
end;
$$;

revoke all on function public.create_complaint(bigint, text[], text[], text, text) from public;
grant execute on function public.create_complaint(bigint, text[], text[], text, text) to anon, authenticated;

notify pgrst, 'reload schema';
