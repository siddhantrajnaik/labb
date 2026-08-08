import { supabase } from './supabase-client.js';

const ok = ({data,error}) => { if (error) throw error; return data; };
export async function signIn(email,password){return ok(await supabase.auth.signInWithPassword({email,password}));}
export async function signOut(){return ok(await supabase.auth.signOut());}
export async function getSession(){return ok(await supabase.auth.getSession());}
export async function getProfile(userId){return ok(await supabase.from('profiles').select('*').eq('id',userId).single());}

export async function loadLabData(labId){
  const q = [
    supabase.from('labs').select('*').eq('id',labId).single(),
    supabase.from('inventory_items').select('*').eq('lab_id',labId).order('name'),
    supabase.from('containers').select('*').eq('lab_id',labId).order('created_at',{ascending:false}),
    supabase.from('vendors').select('*').eq('lab_id',labId).order('name'),
    supabase.from('procurement_requests').select('*, procurement_items(*)').eq('lab_id',labId).order('created_at',{ascending:false}),
    supabase.from('usage_logs').select('*').eq('lab_id',labId).order('created_at',{ascending:false}).limit(100),
    supabase.from('audit_logs').select('*').eq('lab_id',labId).order('created_at',{ascending:false}).limit(100),
    supabase.from('profiles').select('*').eq('lab_id',labId).order('display_name'),
    supabase.from('equipment').select('*').eq('lab_id',labId).order('name'),
    supabase.from('equipment_bookings').select('*').eq('lab_id',labId).order('start_at',{ascending:false}).limit(200),
    supabase.from('equipment_service_logs').select('*').eq('lab_id',labId).order('serviced_at',{ascending:false}).limit(200),
    supabase.from('storage_locations').select('*').eq('lab_id',labId).order('name'),
    supabase.from('samples').select('*').eq('lab_id',labId).order('created_at',{ascending:false}).limit(500)
  ];
  const r = await Promise.all(q);
  r.forEach(x=>{if(x.error)throw x.error});
  let acks=[];
  const ackResult=await supabase.from('notification_acknowledgements').select('*').eq('lab_id',labId).order('acknowledged_at',{ascending:false});
  if(ackResult.error){
    // Keep v0.6 usable during a staged deploy; acknowledgement persistence activates after the migration runs.
    if(!['PGRST205','42P01'].includes(ackResult.error.code)) throw ackResult.error;
    console.warn('Labb v0.6 notification migration is not installed yet.');
  } else acks=ackResult.data||[];
  return {lab:r[0].data,inventory:r[1].data||[],containers:r[2].data||[],vendors:r[3].data||[],procurement:(r[4].data||[]).map(x=>({...x,items:x.procurement_items||[]})),usage:r[5].data||[],audit:r[6].data||[],profiles:r[7].data||[],equipment:r[8].data||[],bookings:r[9].data||[],serviceLogs:r[10].data||[],locations:r[11].data||[],samples:r[12].data||[],acks};
}

export async function addInventory(labId,row){return ok(await supabase.from('inventory_items').insert({...row,lab_id:labId}).select().single());}
export async function addVendor(labId,row){return ok(await supabase.from('vendors').insert({...row,lab_id:labId}).select().single());}
export async function createRequest(labId,userId,row,items){const req=ok(await supabase.from('procurement_requests').insert({...row,lab_id:labId,requested_by:userId}).select().single());const lines=items.map(i=>({...i,request_id:req.id,lab_id:labId}));if(lines.length) ok(await supabase.from('procurement_items').insert(lines));return req;}
export async function placeOrder(requestId,vendorId,expectedDate,total){return ok(await supabase.rpc('place_order',{p_request_id:requestId,p_vendor_id:vendorId,p_expected_date:expectedDate||null,p_ordered_total:+total||0}));}
export async function receiveRequest(requestId,lines){return ok(await supabase.rpc('receive_procurement',{p_request_id:requestId,p_lines:lines}));}
export async function consumeInventory(inventoryId,quantity,project,purpose,containerId=null){return ok(await supabase.rpc('consume_inventory',{p_inventory_id:inventoryId,p_quantity:+quantity,p_project:project||null,p_purpose:purpose||null,p_container_id:containerId||null}));}
export async function adjustInventory(inventoryId,newStock,reason){return ok(await supabase.rpc('adjust_inventory',{p_inventory_id:inventoryId,p_new_stock:+newStock,p_reason:reason||''}));}
export async function updateInvoice(requestId,invoiceAmount,invoiceRef,paymentStatus){return ok(await supabase.from('procurement_requests').update({invoice_amount:+invoiceAmount||0,invoice_ref:invoiceRef||'',payment_status:paymentStatus||'Unpaid'}).eq('id',requestId).select().single());}
export async function closeRequest(requestId){return ok(await supabase.from('procurement_requests').update({status:'Closed'}).eq('id',requestId).select().single());}
export async function updateLab(labId,row){return ok(await supabase.from('labs').update(row).eq('id',labId).select().single());}
export async function ackNotification(labId,notificationKey){return ok(await supabase.from('notification_acknowledgements').insert({lab_id:labId,notification_key:notificationKey}).select().single());}
export async function uploadDocument(labId,entityType,entityId,file){const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');const path=`${labId}/${entityType}/${entityId}/${crypto.randomUUID()}-${safe}`;ok(await supabase.storage.from('labb-documents').upload(path,file,{upsert:false}));return ok(await supabase.from('attachments').insert({lab_id:labId,entity_type:entityType,entity_id:String(entityId),file_name:file.name,storage_path:path,mime_type:file.type||null,size_bytes:file.size}).select().single());}
export async function listAttachments(labId,entityType,entityId){return ok(await supabase.from('attachments').select('*').eq('lab_id',labId).eq('entity_type',entityType).eq('entity_id',String(entityId)).order('created_at',{ascending:false}));}
export async function signedDocumentUrl(path){return ok(await supabase.storage.from('labb-documents').createSignedUrl(path,300));}
export function subscribeLab(labId,onChange){const tables=['inventory_items','containers','vendors','procurement_requests','procurement_items','usage_logs','attachments','notification_acknowledgements','profiles','equipment','equipment_bookings','equipment_service_logs','storage_locations','samples'];const channel=supabase.channel(`labb-${labId}`);tables.forEach(table=>channel.on('postgres_changes',{event:'*',schema:'public',table,filter:`lab_id=eq.${labId}`},onChange));channel.subscribe();return ()=>supabase.removeChannel(channel);}

export async function approveRequest(requestId,note=''){return ok(await supabase.rpc('approve_request',{p_request_id:requestId,p_note:note||''}));}
export async function updateTeamMember(userId,row){return ok(await supabase.from('profiles').update(row).eq('id',userId).select().single());}
export async function addEquipment(labId,row){return ok(await supabase.from('equipment').insert({...row,lab_id:labId}).select().single());}
export async function updateEquipment(id,row){return ok(await supabase.from('equipment').update(row).eq('id',id).select().single());}
export async function addBooking(labId,row){return ok(await supabase.from('equipment_bookings').insert({...row,lab_id:labId}).select().single());}
export async function addServiceLog(labId,row){return ok(await supabase.from('equipment_service_logs').insert({...row,lab_id:labId}).select().single());}
export async function addLocation(labId,row){return ok(await supabase.from('storage_locations').insert({...row,lab_id:labId}).select().single());}
export async function addSample(labId,row){return ok(await supabase.from('samples').insert({...row,lab_id:labId}).select().single());}
export async function updateSample(id,row){return ok(await supabase.from('samples').update(row).eq('id',id).select().single());}

export async function inviteUser(email,displayName,role,redirectTo){return ok(await supabase.functions.invoke('invite-user',{body:{email,display_name:displayName,role,redirectTo}}));}
