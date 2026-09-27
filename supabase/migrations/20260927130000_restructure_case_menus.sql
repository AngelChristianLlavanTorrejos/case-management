-- Nest case-workflow pages under Filing, Notice and Summons, Amicable settlement, and Execution.

insert into public.menus (parent_id, name, icon, path, sort_order, is_active)
select null, 'Filing', 'FileText', null, 3, true
where not exists (
  select 1 from public.menus where name = 'Filing' and parent_id is null
);

insert into public.menus (parent_id, name, icon, path, sort_order, is_active)
select null, 'Notice and Summons', 'Megaphone', null, 4, true
where not exists (
  select 1 from public.menus where name = 'Notice and Summons' and parent_id is null
);

insert into public.menus (parent_id, name, icon, path, sort_order, is_active)
select null, 'Amicable settlement', 'HeartHandshake', null, 5, true
where not exists (
  select 1 from public.menus where name = 'Amicable settlement' and parent_id is null
);

insert into public.menus (parent_id, name, icon, path, sort_order, is_active)
select parent.id, 'Execution', 'Gavel', null, 4, true
from public.menus parent
where parent.name = 'Amicable settlement'
  and parent.parent_id is null
  and not exists (
    select 1
    from public.menus existing
    where existing.name = 'Execution'
      and existing.parent_id = parent.id
  );

update public.menus child
set parent_id = parent.id
from public.menus parent
where parent.name = 'Filing'
  and parent.parent_id is null
  and child.path = '/complainants-form';

update public.menus child
set parent_id = parent.id
from public.menus parent
where parent.name = 'Notice and Summons'
  and parent.parent_id is null
  and child.path in ('/notice-of-hearing', '/summon-for-the-respondent');

update public.menus child
set parent_id = parent.id
from public.menus parent
where parent.name = 'Amicable settlement'
  and parent.parent_id is null
  and child.path in (
    '/amicable-settlement',
    '/repudiation',
    '/certificate-to-file-action'
  );

update public.menus child
set parent_id = parent.id
from public.menus parent
join public.menus folder
  on folder.name = 'Amicable settlement'
 and folder.parent_id is null
where parent.name = 'Execution'
  and parent.parent_id = folder.id
  and child.path in (
    '/motion-for-execution',
    '/notice-of-hearing-motion',
    '/notice-of-execution'
  );

update public.menus
set sort_order = case path
  when '/complainants-form' then 1
  else sort_order
end
where path = '/complainants-form';

update public.menus
set sort_order = case path
  when '/notice-of-hearing' then 1
  when '/summon-for-the-respondent' then 2
  else sort_order
end
where path in ('/notice-of-hearing', '/summon-for-the-respondent');

update public.menus
set sort_order = case path
  when '/amicable-settlement' then 1
  when '/repudiation' then 2
  when '/certificate-to-file-action' then 3
  else sort_order
end
where path in (
  '/amicable-settlement',
  '/repudiation',
  '/certificate-to-file-action'
);

update public.menus
set sort_order = 4
where name = 'Execution'
  and parent_id = (
    select id from public.menus
    where name = 'Amicable settlement' and parent_id is null
  );

update public.menus
set sort_order = case path
  when '/motion-for-execution' then 1
  when '/notice-of-hearing-motion' then 2
  when '/notice-of-execution' then 3
  else sort_order
end
where path in (
  '/motion-for-execution',
  '/notice-of-hearing-motion',
  '/notice-of-execution'
);

update public.menus
set sort_order = case name
  when 'Dashboard' then 1
  when 'Community Members' then 2
  when 'Filing' then 3
  when 'Notice and Summons' then 4
  when 'Amicable settlement' then 5
  when 'Masterfile' then 6
  when 'User Activity Log' then 7
  when 'Baseline Security' then 8
  when 'My Profile' then 9
  when 'Change Password' then 10
  else sort_order
end
where parent_id is null;
