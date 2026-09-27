insert into public.menus (parent_id, name, icon, path, sort_order, is_active)
select null, 'Notice of Hearing', 'Gavel', '/notice-of-hearing', 4, true
where not exists (
  select 1 from public.menus where path = '/notice-of-hearing'
);

insert into public.menus (parent_id, name, icon, path, sort_order, is_active)
select null, 'Summon for the Respondent', 'Megaphone', '/summon-for-the-respondent', 5, true
where not exists (
  select 1 from public.menus where path = '/summon-for-the-respondent'
);

update public.menus
set sort_order = 6
where name = 'Masterfile' and parent_id is null;

update public.menus
set sort_order = 7
where name = 'User Activity Log' and parent_id is null;

update public.menus
set sort_order = 8
where name = 'Baseline Security' and parent_id is null;

update public.menus
set sort_order = 9
where name = 'My Profile' and parent_id is null;

update public.menus
set sort_order = 10
where name = 'Change Password' and parent_id is null;
