-- Labb v1.0 Admin Bootstrap Script
-- Run this script in Supabase Dashboard -> SQL Editor (https://supabase.com/dashboard/project/hsxwsutqpsvrueuohahr/sql/new)

begin;

-- Step 1: Auto-confirm Email for both Admin users in auth.users
update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now())
where email in ('siddhant.admin1@labb.org', 'siddhant.admin2@labb.org');

-- Step 2: Ensure a laboratory record exists & link profiles
do $$
declare
  v_lab_id uuid;
begin
  select id into v_lab_id from public.labs order by created_at asc limit 1;
  
  if v_lab_id is null then
    insert into public.labs(name, address, po_prefix)
    values ('Labb Research Laboratory', 'Hyderabad, India', 'LABB-PO')
    returning id into v_lab_id;
  end if;

  -- Insert or update Admin 1 Profile
  insert into public.profiles(id, lab_id, display_name, email, role, active)
  values (
    '9d77db0c-8b80-487b-bb2e-c0cbc27d5151'::uuid,
    v_lab_id,
    'Siddhant Admin 1',
    'siddhant.admin1@labb.org',
    'admin',
    true
  )
  on conflict (id) do update set
    lab_id = excluded.lab_id,
    display_name = excluded.display_name,
    email = excluded.email,
    role = 'admin',
    active = true;

  -- Insert or update Admin 2 Profile
  insert into public.profiles(id, lab_id, display_name, email, role, active)
  values (
    '01985fcd-4f85-4944-8007-44b284ee34b0'::uuid,
    v_lab_id,
    'Siddhant Admin 2',
    'siddhant.admin2@labb.org',
    'admin',
    true
  )
  on conflict (id) do update set
    lab_id = excluded.lab_id,
    display_name = excluded.display_name,
    email = excluded.email,
    role = 'admin',
    active = true;

end $$;

commit;
