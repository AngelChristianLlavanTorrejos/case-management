-- Reference data, user profile tables, and one Super Admin seed.
-- Seeded lookup rows are locked with can_delete = false.
-- users.password stores a bcrypt hash (pgcrypto), never plaintext.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- 1. roles
-- ---------------------------------------------------------------------------
create table public.roles (
  id bigint generated always as identity primary key,
  name text not null,
  constraint roles_name_not_blank check (char_length(trim(name)) > 0),
  constraint roles_name_unique unique (name)
);

insert into public.roles (name)
values
  ('Super Admin'),
  ('Admin'),
  ('User');

-- ---------------------------------------------------------------------------
-- 2. suffixes
-- ---------------------------------------------------------------------------
create table public.suffixes (
  id bigint generated always as identity primary key,
  name text not null,
  can_delete boolean not null default true,
  constraint suffixes_name_not_blank check (char_length(trim(name)) > 0),
  constraint suffixes_name_unique unique (name)
);

insert into public.suffixes (name, can_delete)
values
  ('None', false),
  ('Jr.', false),
  ('Sr.', false),
  ('II', false),
  ('III', false),
  ('IV', false),
  ('V', false);

-- ---------------------------------------------------------------------------
-- 3. sex
-- ---------------------------------------------------------------------------
create table public.sex (
  id bigint generated always as identity primary key,
  name text not null,
  constraint sex_name_not_blank check (char_length(trim(name)) > 0),
  constraint sex_name_unique unique (name)
);

insert into public.sex (name)
values
  ('Male'),
  ('Female');

-- ---------------------------------------------------------------------------
-- 4. civil_status
-- ---------------------------------------------------------------------------
create table public.civil_status (
  id bigint generated always as identity primary key,
  name text not null,
  can_delete boolean not null default true,
  constraint civil_status_name_not_blank check (char_length(trim(name)) > 0),
  constraint civil_status_name_unique unique (name)
);

insert into public.civil_status (name, can_delete)
values
  ('Single', false),
  ('Married', false),
  ('Widowed', false),
  ('Divorced', false),
  ('Separated', false),
  ('Annulled', false);

-- ---------------------------------------------------------------------------
-- Locked reference rows cannot be deleted
-- ---------------------------------------------------------------------------
create or replace function public.prevent_locked_reference_delete()
returns trigger
language plpgsql
as $$
begin
  if old.can_delete is false then
    raise exception 'System value "%" cannot be deleted', old.name
      using errcode = 'restrict_violation';
  end if;

  return old;
end;
$$;

create trigger suffixes_prevent_locked_delete
before delete on public.suffixes
for each row
execute function public.prevent_locked_reference_delete();

create trigger civil_status_prevent_locked_delete
before delete on public.civil_status
for each row
execute function public.prevent_locked_reference_delete();

-- ---------------------------------------------------------------------------
-- 5. users
-- ---------------------------------------------------------------------------
create table public.users (
  id bigint generated always as identity primary key,
  role_id bigint not null references public.roles (id) on delete restrict,
  username text not null,
  password text not null,
  status text not null default 'active',
  should_change_password boolean not null default true,
  constraint users_username_not_blank check (char_length(trim(username)) >= 3),
  constraint users_username_unique unique (username),
  constraint users_password_not_blank check (char_length(password) > 0),
  constraint users_status_allowed check (status in ('active', 'inactive', 'suspended'))
);

create index users_role_id_idx on public.users (role_id);

-- ---------------------------------------------------------------------------
-- 6. personal_information (one row per user)
-- ---------------------------------------------------------------------------
create table public.personal_information (
  user_id bigint primary key references public.users (id) on delete cascade,
  first_name text not null,
  middle_name text,
  last_name text not null,
  suffix_id bigint not null references public.suffixes (id) on delete restrict,
  sex_id bigint not null references public.sex (id) on delete restrict,
  civil_status_id bigint not null references public.civil_status (id) on delete restrict,
  birthdate date not null,
  constraint personal_information_first_name_not_blank check (char_length(trim(first_name)) > 0),
  constraint personal_information_last_name_not_blank check (char_length(trim(last_name)) > 0)
);

create index personal_information_suffix_id_idx on public.personal_information (suffix_id);
create index personal_information_sex_id_idx on public.personal_information (sex_id);
create index personal_information_civil_status_id_idx on public.personal_information (civil_status_id);

-- ---------------------------------------------------------------------------
-- 7. contact_information (one row per user)
-- ---------------------------------------------------------------------------
create table public.contact_information (
  user_id bigint primary key references public.users (id) on delete cascade,
  present_address_house_block_lot text not null,
  present_address_street text not null,
  present_address_barangay text not null,
  present_address_municipality_city text not null,
  present_address_province text not null,
  present_address_region text not null,
  present_address_zip_code text not null,
  permanent_address_house_block_lot text not null,
  permanent_address_street text not null,
  permanent_address_barangay text not null,
  permanent_address_municipality_city text not null,
  permanent_address_province text not null,
  permanent_address_region text not null,
  permanent_address_zip_code text not null,
  mobile_number text not null,
  telephone_number text,
  email text not null,
  constraint contact_information_email_unique unique (email),
  constraint contact_information_email_format check (email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);

-- ---------------------------------------------------------------------------
-- Super Admin with Philippine profile and contact data
-- Temporary password: ChangeMe#Manila2026
-- ---------------------------------------------------------------------------
do $$
declare
  v_user_id bigint;
  v_role_id bigint;
  v_suffix_id bigint;
  v_sex_id bigint;
  v_civil_status_id bigint;
begin
  if exists (select 1 from public.users where username = 'superadmin') then
    return;
  end if;

  select id into strict v_role_id from public.roles where name = 'Super Admin';
  select id into strict v_suffix_id from public.suffixes where name = 'None';
  select id into strict v_sex_id from public.sex where name = 'Male';
  select id into strict v_civil_status_id from public.civil_status where name = 'Married';

  insert into public.users (
    role_id,
    username,
    password,
    status,
    should_change_password
  )
  values (
    v_role_id,
    'superadmin',
    extensions.crypt('ChangeMe#Manila2026', extensions.gen_salt('bf')),
    'active',
    true
  )
  returning id into v_user_id;

  insert into public.personal_information (
    user_id,
    first_name,
    middle_name,
    last_name,
    suffix_id,
    sex_id,
    civil_status_id,
    birthdate
  )
  values (
    v_user_id,
    'Gabriel',
    'Enrique',
    'Reyes',
    v_suffix_id,
    v_sex_id,
    v_civil_status_id,
    '1988-04-15'
  );

  insert into public.contact_information (
    user_id,
    present_address_house_block_lot,
    present_address_street,
    present_address_barangay,
    present_address_municipality_city,
    present_address_province,
    present_address_region,
    present_address_zip_code,
    permanent_address_house_block_lot,
    permanent_address_street,
    permanent_address_barangay,
    permanent_address_municipality_city,
    permanent_address_province,
    permanent_address_region,
    permanent_address_zip_code,
    mobile_number,
    telephone_number,
    email
  )
  values (
    v_user_id,
    'Block 8 Lot 15',
    'Don Mariano Marcos Avenue',
    'Commonwealth',
    'Quezon City',
    'Metro Manila',
    'National Capital Region',
    '1121',
    'Block 8 Lot 15',
    'Don Mariano Marcos Avenue',
    'Commonwealth',
    'Quezon City',
    'Metro Manila',
    'National Capital Region',
    '1121',
    '09171234567',
    '(02) 8928-1234',
    'gabriel.reyes@casemanagement.ph'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Lookup tables are readable so the GitHub Pages app can smoke-test the API.
-- User and PII tables stay closed until authentication is designed.
-- ---------------------------------------------------------------------------
alter table public.roles enable row level security;
alter table public.suffixes enable row level security;
alter table public.sex enable row level security;
alter table public.civil_status enable row level security;
alter table public.users enable row level security;
alter table public.personal_information enable row level security;
alter table public.contact_information enable row level security;

create policy roles_select_public
on public.roles
for select
to anon, authenticated
using (true);

create policy suffixes_select_public
on public.suffixes
for select
to anon, authenticated
using (true);

create policy sex_select_public
on public.sex
for select
to anon, authenticated
using (true);

create policy civil_status_select_public
on public.civil_status
for select
to anon, authenticated
using (true);
