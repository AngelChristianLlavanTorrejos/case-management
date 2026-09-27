update public.menus
set sort_order = case name
  when 'Dashboard' then 1
  when 'Masterfile' then 2
  when 'Filing' then 3
  when 'Notice and Summons' then 4
  when 'Settlement' then 5
  when 'Community Members' then 6
  when 'Lupon Members' then 7
  when 'Technical Support' then 8
  when 'Utilities' then 9
  when 'My Profile' then 10
  when 'Change Password' then 11
  else sort_order
end
where parent_id is null;
