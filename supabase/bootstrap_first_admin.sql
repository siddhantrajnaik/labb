-- STEP 1: In Supabase Dashboard -> Authentication -> Users, create/invite your first user.
-- STEP 2: Copy that user's UUID and replace REPLACE_WITH_AUTH_USER_UUID below.
-- STEP 3: Run this file in SQL Editor.

begin;
with new_lab as (
  insert into public.labs(name,address,po_prefix)
  values ('Labb Research Laboratory','Hyderabad, India','LABB-PO')
  returning id
)
insert into public.profiles(id,lab_id,display_name,role,active)
select 'REPLACE_WITH_AUTH_USER_UUID'::uuid,id,'Dr. Aris','admin',true from new_lab;
commit;
