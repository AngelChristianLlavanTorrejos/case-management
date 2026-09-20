create table public.status (
  id bigint generated always as identity primary key,
  name text not null unique
);

insert into public.status (name)
values
  ('active'),
  ('inactive'),
  ('for registration');

alter table public.users
  drop constraint users_status_allowed,
  alter column status drop default,
  alter column status drop not null;

update public.users
set status = null;

alter table public.users
  alter column status type bigint using null;

alter table public.users
  rename column status to status_id;

alter table public.users
  add constraint users_status_id_fkey
  foreign key (status_id) references public.status (id) on delete restrict;

update public.users
set status_id = (select id from public.status where name = 'active');

alter table public.users
  alter column status_id set not null;

create index users_status_id_idx on public.users (status_id);

alter table public.status enable row level security;

create policy status_select_public
on public.status
for select
to anon, authenticated
using (true);
