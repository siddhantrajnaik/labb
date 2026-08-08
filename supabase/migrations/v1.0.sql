-- Labb v1.0 final additive migration (run AFTER v0.6)
-- Adds approvals, team-state, equipment, bookings/service, and sample/freezer storage.

begin;

create extension if not exists btree_gist;

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists active boolean not null default true;
update public.profiles p set email=u.email from auth.users u where u.id=p.id and (p.email is null or p.email='');

create or replace function public.current_lab_id() returns uuid
language sql stable security definer set search_path=public
as $$ select lab_id from public.profiles where id=(select auth.uid()) and active=true $$;
create or replace function public.current_role() returns text
language sql stable security definer set search_path=public
as $$ select role from public.profiles where id=(select auth.uid()) and active=true $$;

alter table public.procurement_requests drop constraint if exists procurement_requests_status_check;
alter table public.procurement_requests add constraint procurement_requests_status_check check(status in ('Requested','Approved','Ordered','Partial','Delivered','Delayed','Closed'));
alter table public.procurement_requests add column if not exists approved_by uuid references auth.users(id);
alter table public.procurement_requests add column if not exists approved_at timestamptz;
alter table public.procurement_requests add column if not exists approval_note text not null default '';

create or replace function public.approve_request(p_request_id bigint,p_note text default '')
returns public.procurement_requests language plpgsql security definer set search_path=public
as $$
declare v_lab uuid=(select public.current_lab_id()); r public.procurement_requests%rowtype;
begin
  if not (select public.is_admin()) then raise exception 'Admin required'; end if;
  update public.procurement_requests set status='Approved',approved_by=(select auth.uid()),approved_at=now(),approval_note=coalesce(p_note,'')
  where id=p_request_id and lab_id=v_lab and status='Requested' returning * into r;
  if not found then raise exception 'Request not found or not awaiting approval'; end if;
  return r;
end $$;

create or replace function public.place_order(p_request_id bigint,p_vendor_id bigint,p_expected_date date,p_ordered_total numeric)
returns public.procurement_requests language plpgsql security definer set search_path=public
as $$
declare v_lab uuid=(select public.current_lab_id()); r public.procurement_requests%rowtype; v_prefix text; v_po text;
begin
  if not (select public.is_admin()) then raise exception 'Admin required'; end if;
  select * into r from public.procurement_requests where id=p_request_id and lab_id=v_lab for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status<>'Approved' then raise exception 'Request must be Approved before ordering'; end if;
  if not exists(select 1 from public.vendors where id=p_vendor_id and lab_id=v_lab) then raise exception 'Vendor not found'; end if;
  select po_prefix into v_prefix from public.labs where id=v_lab;
  v_po=coalesce(r.po_number,coalesce(v_prefix,'LABB-PO')||'-'||extract(year from current_date)::int||'-'||lpad(nextval('public.po_number_seq')::text,5,'0'));
  update public.procurement_requests set vendor_id=p_vendor_id,expected_date=p_expected_date,ordered_total=coalesce(p_ordered_total,0),po_number=v_po,status='Ordered' where id=p_request_id returning * into r;
  return r;
end $$;

revoke all on function public.approve_request(bigint,text) from public;
grant execute on function public.approve_request(bigint,text) to authenticated;

-- Strengthen request-line lab integrity from earlier releases.
drop policy if exists "requester creates request items" on public.procurement_items;
create policy "requester creates request items" on public.procurement_items for insert to authenticated with check (lab_id=(select public.current_lab_id()) and exists(select 1 from public.procurement_requests r where r.id=request_id and r.lab_id=(select public.current_lab_id()) and r.requested_by=(select auth.uid()) and r.status='Requested') and exists(select 1 from public.inventory_items i where i.id=inventory_id and i.lab_id=(select public.current_lab_id())));
drop policy if exists "admins update request items" on public.procurement_items;
create policy "admins update request items" on public.procurement_items for update to authenticated using (lab_id=(select public.current_lab_id()) and (select public.is_admin())) with check (lab_id=(select public.current_lab_id()) and (select public.is_admin()) and exists(select 1 from public.inventory_items i where i.id=inventory_id and i.lab_id=(select public.current_lab_id())));

-- Team administration remains RLS-enforced inside the same lab.
grant update on public.profiles to authenticated;
drop policy if exists "admins update lab profiles" on public.profiles;
create policy "admins update lab profiles" on public.profiles for update to authenticated
using (lab_id=(select public.current_lab_id()) and (select public.is_admin()))
with check (lab_id=(select public.current_lab_id()) and role in ('admin','member'));

create sequence if not exists public.equipment_code_seq start 1;
create table if not exists public.equipment (
 id bigint generated by default as identity primary key,
 lab_id uuid not null references public.labs(id) on delete cascade,
 equipment_code text not null default ('EQ-'||lpad(nextval('public.equipment_code_seq')::text,6,'0')),
 name text not null, model text not null default '', serial_number text not null default '', location text not null default '',
 status text not null default 'AVAILABLE' check(status in ('AVAILABLE','OUT_OF_SERVICE','RETIRED')),
 calibration_due date, maintenance_due date, notes text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(lab_id,equipment_code)
);
create table if not exists public.equipment_bookings (
 id bigint generated by default as identity primary key, lab_id uuid not null references public.labs(id) on delete cascade,
 equipment_id bigint not null references public.equipment(id) on delete cascade, user_id uuid not null references auth.users(id),
 start_at timestamptz not null, end_at timestamptz not null, purpose text not null default '', status text not null default 'CONFIRMED' check(status in ('CONFIRMED','CANCELLED')),
 created_at timestamptz not null default now(), check(end_at>start_at)
);
alter table public.equipment_bookings drop constraint if exists equipment_booking_no_overlap;
alter table public.equipment_bookings add constraint equipment_booking_no_overlap exclude using gist (equipment_id with =, tstzrange(start_at,end_at,'[)') with &&) where (status='CONFIRMED');
create table if not exists public.equipment_service_logs (
 id bigint generated by default as identity primary key, lab_id uuid not null references public.labs(id) on delete cascade,
 equipment_id bigint not null references public.equipment(id) on delete cascade, service_type text not null check(service_type in ('CALIBRATION','MAINTENANCE','REPAIR')),
 serviced_at date not null default current_date, next_due date, provider text not null default '', notes text not null default '', performed_by uuid references auth.users(id), created_at timestamptz not null default now()
);

create table if not exists public.storage_locations (
 id bigint generated by default as identity primary key, lab_id uuid not null references public.labs(id) on delete cascade,
 parent_id bigint references public.storage_locations(id) on delete cascade, name text not null, code text not null default '',
 location_type text not null check(location_type in ('ROOM','FREEZER','SHELF','RACK','BOX')), created_at timestamptz not null default now(), unique(lab_id,code)
);
create sequence if not exists public.sample_code_seq start 1;
create table if not exists public.samples (
 id bigint generated by default as identity primary key, lab_id uuid not null references public.labs(id) on delete cascade,
 sample_code text not null default ('SMP-'||lpad(nextval('public.sample_code_seq')::text,7,'0')), name text not null, project text not null default 'General', owner_id uuid references auth.users(id),
 location_id bigint references public.storage_locations(id) on delete set null, slot text not null default '', quantity numeric(18,6) not null default 1 check(quantity>=0), unit text not null default 'vials',
 status text not null default 'ACTIVE' check(status in ('ACTIVE','CONSUMED','DISPOSED','ARCHIVED')), expiry_date date, notes text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(lab_id,sample_code)
);

alter table public.attachments drop constraint if exists attachments_entity_type_check;
alter table public.attachments add constraint attachments_entity_type_check check(entity_type in ('inventory','request','vendor','equipment','sample','service','other'));

-- Touch and audit new mutable records.
drop trigger if exists trg_touch_equipment on public.equipment;
create trigger trg_touch_equipment before update on public.equipment for each row execute function public.touch_updated_at();
drop trigger if exists trg_touch_samples on public.samples;
create trigger trg_touch_samples before update on public.samples for each row execute function public.touch_updated_at();
DO $$ declare t text; begin
 foreach t in array array['profiles','equipment','equipment_bookings','equipment_service_logs','storage_locations','samples'] loop
   execute format('drop trigger if exists trg_audit_%I on public.%I',t,t);
   execute format('create trigger trg_audit_%I after insert or update or delete on public.%I for each row execute function public.audit_change()',t,t);
 end loop;
end $$;

alter table public.equipment enable row level security;
alter table public.equipment_bookings enable row level security;
alter table public.equipment_service_logs enable row level security;
alter table public.storage_locations enable row level security;
alter table public.samples enable row level security;

grant select,insert,update,delete on public.equipment to authenticated;
grant select,insert,update,delete on public.equipment_bookings to authenticated;
grant select,insert,update,delete on public.equipment_service_logs to authenticated;
grant select,insert,update,delete on public.storage_locations to authenticated;
grant select,insert,update,delete on public.samples to authenticated;
grant usage,select on all sequences in schema public to authenticated;

drop policy if exists "members read equipment" on public.equipment;
drop policy if exists "admins add equipment" on public.equipment;
drop policy if exists "admins update equipment" on public.equipment;
drop policy if exists "admins delete equipment" on public.equipment;
create policy "members read equipment" on public.equipment for select to authenticated using(lab_id=(select public.current_lab_id()));
create policy "admins add equipment" on public.equipment for insert to authenticated with check(lab_id=(select public.current_lab_id()) and (select public.is_admin()));
create policy "admins update equipment" on public.equipment for update to authenticated using(lab_id=(select public.current_lab_id()) and (select public.is_admin())) with check(lab_id=(select public.current_lab_id()) and (select public.is_admin()));
create policy "admins delete equipment" on public.equipment for delete to authenticated using(lab_id=(select public.current_lab_id()) and (select public.is_admin()));

drop policy if exists "members read bookings" on public.equipment_bookings;
drop policy if exists "members create own bookings" on public.equipment_bookings;
drop policy if exists "users cancel own bookings" on public.equipment_bookings;
drop policy if exists "admins delete bookings" on public.equipment_bookings;
create policy "members read bookings" on public.equipment_bookings for select to authenticated using(lab_id=(select public.current_lab_id()));
create policy "members create own bookings" on public.equipment_bookings for insert to authenticated with check(lab_id=(select public.current_lab_id()) and user_id=(select auth.uid()) and exists(select 1 from public.equipment e where e.id=equipment_id and e.lab_id=(select public.current_lab_id()) and e.status='AVAILABLE'));
create policy "users cancel own bookings" on public.equipment_bookings for update to authenticated using(lab_id=(select public.current_lab_id()) and (user_id=(select auth.uid()) or (select public.is_admin()))) with check(lab_id=(select public.current_lab_id()));
create policy "admins delete bookings" on public.equipment_bookings for delete to authenticated using(lab_id=(select public.current_lab_id()) and (select public.is_admin()));

drop policy if exists "members read service logs" on public.equipment_service_logs;
drop policy if exists "admins add service logs" on public.equipment_service_logs;
drop policy if exists "admins update service logs" on public.equipment_service_logs;
drop policy if exists "admins delete service logs" on public.equipment_service_logs;
create policy "members read service logs" on public.equipment_service_logs for select to authenticated using(lab_id=(select public.current_lab_id()));
create policy "admins add service logs" on public.equipment_service_logs for insert to authenticated with check(lab_id=(select public.current_lab_id()) and (select public.is_admin()) and exists(select 1 from public.equipment e where e.id=equipment_id and e.lab_id=(select public.current_lab_id())));
create policy "admins update service logs" on public.equipment_service_logs for update to authenticated using(lab_id=(select public.current_lab_id()) and (select public.is_admin())) with check(lab_id=(select public.current_lab_id()) and (select public.is_admin()) and exists(select 1 from public.equipment e where e.id=equipment_id and e.lab_id=(select public.current_lab_id())));
create policy "admins delete service logs" on public.equipment_service_logs for delete to authenticated using(lab_id=(select public.current_lab_id()) and (select public.is_admin()));

drop policy if exists "members read storage locations" on public.storage_locations;
drop policy if exists "admins add storage locations" on public.storage_locations;
drop policy if exists "admins update storage locations" on public.storage_locations;
drop policy if exists "admins delete storage locations" on public.storage_locations;
create policy "members read storage locations" on public.storage_locations for select to authenticated using(lab_id=(select public.current_lab_id()));
create policy "admins add storage locations" on public.storage_locations for insert to authenticated with check(lab_id=(select public.current_lab_id()) and (select public.is_admin()) and (parent_id is null or exists(select 1 from public.storage_locations p where p.id=parent_id and p.lab_id=(select public.current_lab_id()))));
create policy "admins update storage locations" on public.storage_locations for update to authenticated using(lab_id=(select public.current_lab_id()) and (select public.is_admin())) with check(lab_id=(select public.current_lab_id()) and (select public.is_admin()) and (parent_id is null or exists(select 1 from public.storage_locations p where p.id=parent_id and p.lab_id=(select public.current_lab_id()))));
create policy "admins delete storage locations" on public.storage_locations for delete to authenticated using(lab_id=(select public.current_lab_id()) and (select public.is_admin()));

drop policy if exists "members read samples" on public.samples;
drop policy if exists "members add samples" on public.samples;
drop policy if exists "owners or admins update samples" on public.samples;
drop policy if exists "admins delete samples" on public.samples;
create policy "members read samples" on public.samples for select to authenticated using(lab_id=(select public.current_lab_id()));
create policy "members add samples" on public.samples for insert to authenticated with check(lab_id=(select public.current_lab_id()) and owner_id=(select auth.uid()) and (location_id is null or exists(select 1 from public.storage_locations l where l.id=location_id and l.lab_id=(select public.current_lab_id()))));
create policy "owners or admins update samples" on public.samples for update to authenticated using(lab_id=(select public.current_lab_id()) and (owner_id=(select auth.uid()) or (select public.is_admin()))) with check(lab_id=(select public.current_lab_id()) and (owner_id=(select auth.uid()) or (select public.is_admin())) and (location_id is null or exists(select 1 from public.storage_locations l where l.id=location_id and l.lab_id=(select public.current_lab_id()))));
create policy "admins delete samples" on public.samples for delete to authenticated using(lab_id=(select public.current_lab_id()) and (select public.is_admin()));

DO $$ declare t text; begin
 foreach t in array array['profiles','equipment','equipment_bookings','equipment_service_logs','storage_locations','samples'] loop
   if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t); end if;
 end loop;
end $$;

commit;
