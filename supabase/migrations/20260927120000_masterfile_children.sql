-- Masterfile is a folder. Keep it pathless and re-attach its lookup pages.

update public.menus
set path = null
where name = 'Masterfile'
  and parent_id is null;

update public.menus child
set
  parent_id = parent.id,
  is_active = true
from public.menus parent
where parent.name = 'Masterfile'
  and parent.parent_id is null
  and child.path in (
    '/masterfile/suffixes',
    '/masterfile/civil-status',
    '/masterfile/complaint-types'
  )
  and child.parent_id is distinct from parent.id;

insert into public.menus (parent_id, name, icon, path, sort_order, is_active)
select parent.id, child.name, child.icon, child.path, child.sort_order, true
from public.menus parent
cross join (
  values
    ('Suffix', 'Tags', '/masterfile/suffixes', 1),
    ('Civil Status', 'HeartHandshake', '/masterfile/civil-status', 2),
    ('Complaint Types', 'Scale', '/masterfile/complaint-types', 3)
) as child(name, icon, path, sort_order)
where parent.name = 'Masterfile'
  and parent.parent_id is null
  and not exists (
    select 1 from public.menus existing where existing.path = child.path
  );
