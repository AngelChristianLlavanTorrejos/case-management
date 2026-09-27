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
