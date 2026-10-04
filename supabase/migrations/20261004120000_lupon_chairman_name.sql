-- Display name of the current Lupon Chairman/Barangay Chairman, if any.

create or replace function public.get_lupon_chairman_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select public.user_display_name(u.id)
  from public.users u
  join public.positions p on p.id = u.position_id
  where p.name = 'Lupon Chairman/Barangay Chairman'
  order by u.id
  limit 1;
$$;

revoke all on function public.get_lupon_chairman_name() from public;
grant execute on function public.get_lupon_chairman_name() to anon, authenticated;

notify pgrst, 'reload schema';
