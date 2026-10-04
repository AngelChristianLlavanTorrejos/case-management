-- Staff-created complaints are auto received-and-filed (no SMS path on create).
-- Notify info exposes creator role so SMS can skip staff-owned cases.

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
  v_role_name text;
  v_complainants text[];
  v_respondents text[];
  v_manner text := btrim(coalesce(p_manner, ''));
  v_relief text := btrim(coalesce(p_relief, ''));
  v_name text;
  v_index integer;
  v_received_at timestamptz;
  v_year text;
  v_prefix text;
  v_seq integer;
  v_case_no text;
begin
  perform public.require_activity_actor(p_actor_user_id);

  select r.name
  into v_role_name
  from public.users u
  join public.roles r on r.id = u.role_id
  where u.id = p_actor_user_id;

  if v_role_name is null then
    raise exception 'Actor not found';
  end if;

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

  if v_role_name = 'User' then
    insert into public.complaints (user_id, complaint_type_id, manner, relief)
    values (p_actor_user_id, p_complaint_type_id, v_manner, v_relief)
    returning id into v_complaint_id;
  else
    v_received_at := now();
    v_year := to_char(v_received_at, 'YYYY');
    v_prefix := v_year || '-TANZA-';

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
      is_received_and_filed,
      received_and_filed_at,
      barangay_case_no
    )
    values (
      p_actor_user_id,
      p_complaint_type_id,
      v_manner,
      v_relief,
      true,
      v_received_at,
      v_case_no
    )
    returning id into v_complaint_id;
  end if;

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
      'relief', v_relief,
      'is_received_and_filed', v_role_name <> 'User',
      'barangay_case_no', v_case_no
    )
  );

  return json_build_object('ok', true, 'id', v_complaint_id);
end;
$$;

create or replace function public.get_complaint_notify_info(p_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  select json_build_object(
    'mobile_number', ci.mobile_number,
    'barangay_case_no', c.barangay_case_no,
    'appear_at', n.appear_at,
    'complainants', coalesce(
      (
        select string_agg(p.name, ', ' order by p.sort_order)
        from public.complaint_parties p
        where p.complaint_id = c.id and p.party_type = 'complainant'
      ),
      ''
    ),
    'creator_role', coalesce(r.name, '')
  )
  into v_result
  from public.complaints c
  left join public.users u on u.id = c.user_id
  left join public.roles r on r.id = u.role_id
  left join public.contact_information ci on ci.user_id = c.user_id
  left join public.notice_of_hearing n on n.complaint_id = c.id
  where c.id = p_id;

  if v_result is null then
    raise exception 'Complaint not found';
  end if;

  return v_result;
end;
$$;

notify pgrst, 'reload schema';
