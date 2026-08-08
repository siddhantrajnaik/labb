-- OPTIONAL demo seed after schema.sql and bootstrap_first_admin.sql.
-- Uses the first lab found. Run once only on an empty Labb database.
do $$
declare v_lab uuid; a bigint; b bigint; c bigint; d bigint; e bigint;
begin
  select id into v_lab from public.labs order by created_at limit 1;
  if v_lab is null then raise exception 'Create a lab first'; end if;
  if exists(select 1 from public.inventory_items where lab_id=v_lab) then raise exception 'Inventory already contains data'; end if;
  insert into public.inventory_items(lab_id,name,category,sku,cas,min_stock,unit,storage,expiry_date,project,unit_cost,manufacturer) values
  (v_lab,'Acetone','Chemical','CHEM-ACE','67-64-1',4,'bottles','Flammables cabinet','2027-02-15','Project A',950,'Merck') returning id into a;
  insert into public.inventory_items(lab_id,name,category,sku,min_stock,unit,storage,expiry_date,project,unit_cost) values
  (v_lab,'Nitrile Gloves M','Consumable','PPE-GLV-M',5,'boxes','Store A','2028-05-01','General',620) returning id into b;
  insert into public.inventory_items(lab_id,name,category,sku,min_stock,unit,storage,project,unit_cost) values
  (v_lab,'Filter Paper 90 mm','Consumable','FIL-090',6,'packs','Store B','Project A',480) returning id into c;
  insert into public.inventory_items(lab_id,name,category,sku,min_stock,unit,storage,expiry_date,project,unit_cost) values
  (v_lab,'PBS Tablets','Chemical','BUF-PBS',4,'bottles','Room temperature','2026-10-18','Project B',1650) returning id into d;
  insert into public.inventory_items(lab_id,name,category,sku,min_stock,unit,storage,project,unit_cost,manufacturer) values
  (v_lab,'Cryo-EM Grids R1.2/1.3','Cryo-EM','CRYO-R12',2,'boxes','Desiccator','CryoEM',12500,'Quantifoil') returning id into e;
  insert into public.containers(lab_id,inventory_id,quantity_initial,quantity_remaining,unit,lot_number,received_date,expiry_date,storage) values
  (v_lab,a,6,6,'bottles','LOT-26-1','2026-08-01','2027-02-15','Flammables cabinet'),
  (v_lab,b,3,3,'boxes','LOT-26-2','2026-08-01','2028-05-01','Store A'),
  (v_lab,c,8,8,'packs','LOT-26-3','2026-08-01',null,'Store B'),
  (v_lab,d,2,2,'bottles','LOT-26-4','2026-08-01','2026-10-18','Room temperature'),
  (v_lab,e,1,1,'boxes','LOT-26-5','2026-08-01',null,'Desiccator');
  insert into public.vendors(lab_id,name,contact,email,phone,city,rating) values
  (v_lab,'ABC Scientific','Meera Shah','sales@abc.example','+91 90000 10001','Hyderabad',4.7),
  (v_lab,'BioLab Supplies','Naveen R','orders@biolab.example','+91 90000 10002','Bengaluru',4.4);
end $$;
