create table if not exists public.positions (
  id bigint generated always as identity primary key,
  name text not null,
  sort_order integer not null,
  constraint positions_name_not_blank check (char_length(btrim(name)) > 0),
  constraint positions_name_unique unique (name)
);

insert into public.positions (name, sort_order)
values
  ('Lupon Chairman/Barangay Chairman', 1),
  ('Lupon Secretary/Barangay Secretary', 2),
  ('Lupon Member', 3)
on conflict (name) do nothing;

alter table public.positions enable row level security;
revoke all on table public.positions from public, anon, authenticated;

drop policy if exists positions_select on public.positions;
create policy positions_select
on public.positions
for select
to anon, authenticated
using (true);

grant select on table public.positions to anon, authenticated;

delete from public.menus
where path = '/masterfile/roles';

insert into public.menus (parent_id, name, icon, path, sort_order, is_active)
select parent.id, 'Positions', 'BadgeCheck', '/masterfile/positions', 4, true
from public.menus parent
where parent.name = 'Masterfile'
  and parent.parent_id is null
  and not exists (
    select 1 from public.menus where path = '/masterfile/positions'
  );

with ordered as (
  select
    child.id,
    row_number() over (order by lower(child.name), child.name) as sort_order
  from public.menus child
  join public.menus parent on parent.id = child.parent_id
  where parent.name = 'Masterfile'
    and parent.parent_id is null
)
update public.menus menu
set sort_order = ordered.sort_order
from ordered
where menu.id = ordered.id;
