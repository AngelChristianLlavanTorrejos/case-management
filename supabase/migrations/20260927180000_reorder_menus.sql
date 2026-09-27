insert into public.menus (parent_id, name, icon, path, sort_order, is_active)
select null, 'Utilities', 'Wrench', null, 7, true
where not exists (
  select 1 from public.menus where name = 'Utilities' and parent_id is null
);

update public.menus child
set
  parent_id = parent.id,
  sort_order = case child.name
    when 'Baseline Security' then 1
    when 'User Activity Log' then 2
    else child.sort_order
  end
from public.menus parent
where parent.name = 'Utilities'
  and parent.parent_id is null
  and child.name in ('Baseline Security', 'User Activity Log');

update public.menus
set sort_order = case name
  when 'Dashboard' then 1
  when 'Masterfile' then 2
  when 'Filing' then 3
  when 'Notice and Summons' then 4
  when 'Settlement' then 5
  when 'Community Members' then 6
  when 'Utilities' then 7
  when 'My Profile' then 8
  when 'Change Password' then 9
  else sort_order
end
where parent_id is null;
