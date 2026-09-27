-- Flatten the Amicable settlement folder into Settlement.
-- Execution pages sit beside Amicable Settlement, not under a nested Execution folder.

update public.menus
set name = 'Settlement'
where name = 'Amicable settlement'
  and parent_id is null
  and path is null;

update public.menus child
set
  parent_id = parent.id,
  sort_order = case child.path
    when '/amicable-settlement' then 1
    when '/repudiation' then 2
    when '/certificate-to-file-action' then 3
    when '/motion-for-execution' then 4
    when '/notice-of-hearing-motion' then 5
    when '/notice-of-execution' then 6
    else child.sort_order
  end
from public.menus parent
where parent.name = 'Settlement'
  and parent.parent_id is null
  and child.path in (
    '/amicable-settlement',
    '/repudiation',
    '/certificate-to-file-action',
    '/motion-for-execution',
    '/notice-of-hearing-motion',
    '/notice-of-execution'
  );

delete from public.menus folder
where folder.name = 'Execution'
  and folder.path is null
  and not exists (
    select 1
    from public.menus child
    where child.parent_id = folder.id
  );
