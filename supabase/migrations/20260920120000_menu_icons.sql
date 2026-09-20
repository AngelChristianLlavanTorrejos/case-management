update public.menus
set icon = 'LayoutDashboard'
where name = 'Dashboard' and parent_id is null;

update public.menus
set icon = 'Users'
where name = 'Community Members' and parent_id is null;
