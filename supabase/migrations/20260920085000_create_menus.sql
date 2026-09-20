create table public.menus (
  id bigint generated always as identity primary key,
  parent_id bigint references public.menus (id) on delete restrict,
  name text not null,
  icon text not null,
  path text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  constraint menus_name_not_blank check (char_length(trim(name)) > 0),
  constraint menus_icon_not_blank check (char_length(trim(icon)) > 0)
);

create index menus_parent_id_idx on public.menus (parent_id);
create index menus_sort_order_idx on public.menus (parent_id, sort_order);

insert into public.menus (parent_id, name, icon, path, sort_order, is_active)
values
  (null, 'Dashboard', 'LayoutDashboard', '/', 1, true),
  (null, 'Masterfile', 'FolderTree', null, 2, true);

insert into public.menus (parent_id, name, icon, path, sort_order, is_active)
select m.id, 'Suffix', 'Tags', '/masterfile/suffixes', 1, true
from public.menus m
where m.name = 'Masterfile' and m.parent_id is null;

insert into public.menus (parent_id, name, icon, path, sort_order, is_active)
select m.id, 'Civil Status', 'HeartHandshake', '/masterfile/civil-status', 2, true
from public.menus m
where m.name = 'Masterfile' and m.parent_id is null;

alter table public.menus enable row level security;

-- App uses the publishable key (anon). Active menus are navigation metadata, not PII.
create policy menus_select_active
on public.menus
for select
to anon, authenticated
using (is_active = true);
