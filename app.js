import { configured, supabase } from './supabase-client.js';
import * as api from './api.js';

const VERSION='0.6.0-supabase';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const money=n=>'₹'+Number(n||0).toLocaleString('en-IN');
const today=()=>new Date().toISOString().slice(0,10);
let user=null, profile=null, db={lab:null,inventory:[],containers:[],vendors:[],procurement:[],usage:[],audit:[],acks:[]};
let page='dashboard', search='', selectedItemId=null, showAckNotifs=false, unsubscribe=null, refreshTimer=null;
const admin=()=>profile?.role==='admin';

function toast(s){const t=$('#toast');t.textContent=s;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2300)}
function fail(e){console.error(e);toast(e?.message||String(e));}
function low(x){return Number(x.current_stock)<=Number(x.min_stock)}
function expiry(date,days=90){if(!date)return null;const a=new Date();a.setHours(0,0,0,0);const d=Math.ceil((new Date(date+'T00:00:00')-a)/86400000);return{days:d,expired:d<0,warning:d>=0&&d<=days}}
function dl(text,name,type='text/plain'){const a=document.createElement('a');const u=URL.createObjectURL(new Blob([text],{type}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),500)}
function csv(){const c=['item_code','sku','name','category','cas','current_stock','min_stock','unit','storage','expiry_date','project','unit_cost'];const q=v=>`"${String(v??'').replaceAll('"','""')}"`;return[c.join(','),...db.inventory.map(r=>c.map(k=>q(r[k])).join(','))].join('\n')}
function chip(s){return `<span class="chip ${String(s).toLowerCase()}">${esc(s)}</span>`}
function modal(title,body,onSave,save='Save'){$('#modal').innerHTML=`<div class="modalbg"><div class="modalbox"><div class="modalhead"><b>${esc(title)}</b><button id="mx">✕</button></div><div class="modalbody">${body}</div><div class="modalfoot"><button id="mc">Cancel</button><button class="primary" id="ms">${esc(save)}</button></div></div></div>`;$('#mx').onclick=$('#mc').onclick=()=>$('#modal').innerHTML='';$('#ms').onclick=async()=>{try{await onSave();$('#modal').innerHTML=''}catch(e){fail(e)}}}

async function refresh(){if(!profile)return;db=await api.loadLabData(profile.lab_id, user.id);updateBadge();render()}
function scheduleRefresh(){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>refresh().catch(fail),250)}

function getNotifications(){
  const list=[];
  db.inventory.filter(low).forEach(x=>{
    list.push({
      key:`item_low_${x.id}`,
      type:'warning',
      title:`Low stock alert: ${x.name}`,
      message:`Current stock (${x.current_stock} ${x.unit}) is at or below minimum threshold (${x.min_stock} ${x.unit}).`,
      actionPage:'inventory',
      itemId:x.id
    });
  });
  db.containers.forEach(c=>{
    if(c.status!=='ACTIVE'||Number(c.quantity_remaining)<=0)return;
    const e=expiry(c.expiry_date,db.lab?.expiry_notice_days||90);
    if(e?.expired){
      const inv=db.inventory.find(i=>i.id===c.inventory_id);
      list.push({
        key:`container_exp_${c.id}`,
        type:'danger',
        title:`Expired container: ${c.container_code} (${inv?.name||'Item'})`,
        message:`Container expired on ${c.expiry_date}. Qty remaining: ${c.quantity_remaining} ${c.unit}.`,
        actionPage:'inventory',
        itemId:c.inventory_id
      });
    }else if(e?.warning){
      const inv=db.inventory.find(i=>i.id===c.inventory_id);
      list.push({
        key:`container_exp_${c.id}`,
        type:'warning',
        title:`Expiring container: ${c.container_code} (${inv?.name||'Item'})`,
        message:`Container expires in ${e.days} days (${c.expiry_date}). Qty remaining: ${c.quantity_remaining} ${c.unit}.`,
        actionPage:'inventory',
        itemId:c.inventory_id
      });
    }
  });
  const now=new Date();
  db.procurement.forEach(r=>{
    if(r.status==='Ordered'&&r.created_at){
      const days=Math.floor((now-new Date(r.created_at))/86400000);
      if(days>7){
        list.push({
          key:`req_delay_${r.id}`,
          type:'warning',
          title:`Delayed procurement: Order #${r.po_number||r.id}`,
          message:`Order placed ${days} days ago has not been delivered. Expected: ${r.expected_date||'Unspecified'}.`,
          actionPage:'procurement'
        });
      }
    }
    if(r.status==='Requested'){
      list.push({
        key:`req_pending_${r.id}`,
        type:'info',
        title:`Pending procurement request: ${r.project||'General'}`,
        message:`Requested on ${new Date(r.created_at).toLocaleDateString()} by ${r.requester_name||'Lab member'}.`,
        actionPage:'procurement'
      });
    }
    if(r.status==='Delivered'&&(r.payment_status==='Unpaid'||!r.invoice_ref)){
      list.push({
        key:`req_invoice_${r.id}`,
        type:'info',
        title:`Delivered order awaiting invoice: #${r.po_number||r.id}`,
        message:`Order delivered. Invoice reference or payment status needs reconciliation.`,
        actionPage:'procurement'
      });
    }
  });
  return list.map(n=>({...n, ack: db.acks.includes(n.key)}));
}

function updateBadge(){
  const notifs=getNotifications();
  const unack=notifs.filter(n=>!n.ack).length;
  const b=$('#navBadge');
  if(b){
    b.textContent=unack;
    b.hidden=unack===0;
  }
}

async function establish(session){user=session?.user||null;if(!user){showLogin();return}profile=await api.getProfile(user.id);$('#who').textContent=profile.display_name||user.email;$('#role').textContent=profile.role==='admin'?'Lab Admin':'Lab Member';$('#login').style.display='none';$('#app').hidden=false;await refresh();if(unsubscribe)unsubscribe();unsubscribe=api.subscribeLab(profile.lab_id,scheduleRefresh)}
function showLogin(){user=profile=null;db={lab:null,inventory:[],containers:[],vendors:[],procurement:[],usage:[],audit:[],acks:[]};$('#app').hidden=true;$('#login').style.display='grid';if(unsubscribe){unsubscribe();unsubscribe=null}}

$('#configWarning').hidden=configured;$('#loginForm').addEventListener('submit',async e=>{e.preventDefault();if(!configured)return;const m=$('#loginMessage');m.textContent='Signing in…';try{const r=await api.signIn($('#email').value.trim(),$('#password').value);m.textContent='';await establish(r.session)}catch(x){m.textContent=x.message}});
if(configured){api.getSession().then(r=>establish(r.session)).catch(fail);supabase.auth.onAuthStateChange((_e,s)=>{if(!s)showLogin()})}

$$('[data-page]').forEach(b=>b.onclick=()=>{page=b.dataset.page;search='';$('#search').value='';$$('[data-page]').forEach(x=>x.classList.toggle('active',x.dataset.page===page));render()});
$('#search').oninput=e=>{search=e.target.value.toLowerCase();render()};
$('#newRequest').onclick=()=>requestModal();$('#scan').onclick=()=>scanModal();

function getMetrics(){
  const totalVal=db.inventory.reduce((s,x)=>s+Number(x.current_stock||0)*Number(x.unit_cost||0),0);
  const activeCont=db.containers.filter(c=>c.status==='ACTIVE'&&Number(c.quantity_remaining)>0).length;
  const lowCount=db.inventory.filter(low).length;
  const ex=db.containers.map(c=>expiry(c.expiry_date,db.lab?.expiry_notice_days||90)).filter(Boolean);
  const expCount=ex.filter(e=>e.expired||e.warning).length;
  const pendingReq=db.procurement.filter(r=>!['Delivered','Closed'].includes(r.status)).length;
  const orderedVal=db.procurement.reduce((s,r)=>s+Number(r.ordered_total||0),0);
  
  const now=new Date();
  const curMonth=now.getMonth();
  const curYear=now.getFullYear();
  const monthSpend=db.procurement.filter(r=>r.created_at&&new Date(r.created_at).getMonth()===curMonth&&new Date(r.created_at).getFullYear()===curYear).reduce((s,r)=>s+Number(r.ordered_total||0),0);

  return {totalVal, activeCont, lowCount, expCount, pendingReq, orderedVal, monthSpend};
}

function render(){if(!profile)return;if(page==='dashboard')dashboardPage();else if(page==='inventory')inventory();else if(page==='inventory_detail')inventoryDetailPage();else if(page==='procurement')procurement();else if(page==='vendors')vendors();else if(page==='notifications')notificationsPage();else if(page==='analytics')analytics();else settings()}

function dashboardPage(){
  const m=getMetrics();
  const notifs=getNotifications().filter(n=>!n.ack);
  $('#page').innerHTML=`
    <div class="page-head">
      <div>
        <h1>Executive Dashboard</h1>
        <p>Real-time laboratory inventory valuation, container tracking, and procurement overview.</p>
      </div>
      <div class="actions">
        <button id="dbNewReq" class="primary">+ New Request</button>
        ${admin()?'<button id="dbAddItem">+ Add Inventory</button>':''}
      </div>
    </div>
    
    <div class="stats">
      <div class="stat">
        <span>Total Valuation</span>
        <strong>${money(m.totalVal)}</strong>
        <small>${db.inventory.length} items · ${m.activeCont} active containers</small>
      </div>
      <div class="stat">
        <span>Low Stock Items</span>
        <strong class="${m.lowCount>0?'danger':''}">${m.lowCount}</strong>
        <small>at/below minimum threshold</small>
      </div>
      <div class="stat">
        <span>Expiry Alerts</span>
        <strong class="${m.expCount>0?'danger':''}">${m.expCount}</strong>
        <small>expired or near-expiry lots</small>
      </div>
      <div class="stat">
        <span>Monthly Spend</span>
        <strong>${money(m.monthSpend)}</strong>
        <small>${m.pendingReq} open procurement orders</small>
      </div>
    </div>

    ${notifs.length?`
      <div class="alerts">
        <b>🔔 ${notifs.length} active unacknowledged alert${notifs.length>1?'s':''}</b>
        <div class="sub">${notifs.slice(0,5).map(n=>esc(n.title)).join(' · ')}</div>
        <div style="margin-top:8px"><button id="btnViewNotifs" style="padding:4px 10px;font-size:11px">Open Notification Center →</button></div>
      </div>
    `:''}

    <div class="grid">
      <section class="panel">
        <h2>Stock Attention Needed</h2>
        <div class="table-wrap" style="margin-top:10px">
          <table>
            <thead><tr><th>Item</th><th>Stock</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              ${db.inventory.filter(low).slice(0,6).map(x=>`
                <tr>
                  <td><b>${esc(x.name)}</b><div class="sub">${esc(x.category)}</div></td>
                  <td><b class="danger">${x.current_stock} ${esc(x.unit)}</b><div class="sub">min ${x.min_stock}</div></td>
                  <td><span class="chip delayed">Low Stock</span></td>
                  <td><button data-detail="${x.id}" style="padding:4px 8px;font-size:11px">View</button></td>
                </tr>
              `).join('')||'<tr><td colspan="4" class="sub">All inventory items above minimum stock levels.</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel">
        <h2>Recent Activity & Audit Log</h2>
        <div class="audit" style="margin-top:10px">
          ${db.audit.slice(0,8).map(a=>`
            <div class="auditrow">
              <b>${esc(a.action)}</b> · ${esc(a.entity_type)} #${esc(a.entity_id||'')}
              <div class="sub">${new Date(a.created_at).toLocaleString()} · ${esc(a.actor_email||a.actor_id||'system')}</div>
            </div>
          `).join('')||'<div class="sub">No recent activity</div>'}
        </div>
      </section>
    </div>
  `;

  if(admin())$('#dbAddItem').onclick=itemModal;
  $('#dbNewReq').onclick=requestModal;
  if($('#btnViewNotifs')) $('#btnViewNotifs').onclick=()=>{page='notifications';render()};
  $$('[data-detail]').forEach(b=>b.onclick=()=>{selectedItemId=+b.dataset.detail;page='inventory_detail';render()});
}

function inventory(){
  const rows=db.inventory.filter(x=>!search||JSON.stringify(x).toLowerCase().includes(search));
  $('#page').innerHTML=`
    <div class="page-head">
      <div>
        <h1>Laboratory Inventory</h1>
        <p>Container-based stock ledger, FEFO automated tracking, and RLS security policies.</p>
      </div>
      ${admin()?'<button class="primary" id="addItem">+ Add Item</button>':''}
    </div>
    <div class="toolbar">
      <input id="invSearch" value="${esc(search)}" placeholder="Search item name, SKU, CAS, category...">
      <button id="exportCsv">Export CSV</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>CAS</th>
            <th>Stock</th>
            <th>Storage</th>
            <th>Expiry</th>
            <th>Project</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(x=>`
            <tr>
              <td>
                <b data-openitem="${x.id}" style="cursor:pointer;color:var(--p)">${esc(x.name)} 🔗</b>
                <div class="sub">${esc(x.item_code)} · ${esc(x.sku||'—')} · ${esc(x.category)}</div>
              </td>
              <td>${x.cas?esc(x.cas):'—'}</td>
              <td>
                <b class="${low(x)?'danger':''}">${x.current_stock} ${esc(x.unit)}</b>
                <div class="sub">min ${x.min_stock}</div>
              </td>
              <td>${esc(x.storage||'—')}</td>
              <td>${esc(x.expiry_date||'—')}</td>
              <td>${esc(x.project||'—')}</td>
              <td>
                <div class="actions">
                  <button data-detail="${x.id}">Profile</button>
                  <button data-use="${x.id}">Use</button>
                  <button data-cont="${x.id}">Lots</button>
                  ${admin()?`<button data-adj="${x.id}">Adjust</button><button data-doc="${x.id}">Docs</button>`:''}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  if(admin())$('#addItem').onclick=itemModal;
  $('#exportCsv').onclick=()=>dl(csv(),'labb_inventory.csv','text/csv');
  $('#invSearch').oninput=e=>{search=e.target.value.toLowerCase();$('#search').value=e.target.value;inventory()};
  $$('[data-openitem]').forEach(b=>b.onclick=()=>{selectedItemId=+b.dataset.openitem;page='inventory_detail';render()});
  $$('[data-detail]').forEach(b=>b.onclick=()=>{selectedItemId=+b.dataset.detail;page='inventory_detail';render()});
  $$('[data-use]').forEach(b=>b.onclick=()=>usageModal(+b.dataset.use));
  $$('[data-cont]').forEach(b=>b.onclick=()=>containersModal(+b.dataset.cont));
  $$('[data-adj]').forEach(b=>b.onclick=()=>adjustModal(+b.dataset.adj));
  $$('[data-doc]').forEach(b=>b.onclick=()=>documentsModal('inventory',b.dataset.doc));
}

function inventoryDetailPage(){
  const item=db.inventory.find(i=>i.id===selectedItemId)||db.inventory[0];
  if(!item){page='inventory';render();return;}
  selectedItemId=item.id;
  const cs=db.containers.filter(c=>c.inventory_id===item.id);
  const activeCs=cs.filter(c=>c.status==='ACTIVE'&&Number(c.quantity_remaining)>0);
  const itemUsage=db.usage.filter(u=>u.inventory_id===item.id);

  const stockRatio=item.min_stock>0?Math.min(100, Math.round((item.current_stock/item.min_stock)*100)):100;

  $('#page').innerHTML=`
    <div class="page-head">
      <div>
        <button id="btnBackInv" style="margin-bottom:8px">← Back to Inventory</button>
        <h1>${esc(item.name)}</h1>
        <p>${esc(item.item_code)} · Category: ${esc(item.category)} · CAS: ${esc(item.cas||'N/A')}</p>
      </div>
      <div class="actions">
        <button data-use="${item.id}" class="primary">Record Usage</button>
        ${admin()?`<button data-adj="${item.id}">Adjust Stock</button>`:''}
        <button data-doc="${item.id}">Documents</button>
        <button data-lab="${item.id}">Print Label</button>
      </div>
    </div>

    <div class="stats">
      <div class="stat">
        <span>Current Stock</span>
        <strong class="${low(item)?'danger':''}">${item.current_stock} ${esc(item.unit)}</strong>
        <small>Minimum required: ${item.min_stock} ${esc(item.unit)}</small>
      </div>
      <div class="stat">
        <span>Total Valuation</span>
        <strong>${money(Number(item.current_stock||0)*Number(item.unit_cost||0))}</strong>
        <small>Unit cost: ${money(item.unit_cost)} / ${esc(item.unit)}</small>
      </div>
      <div class="stat">
        <span>Active Lots</span>
        <strong>${activeCs.length}</strong>
        <small>${cs.length} total containers recorded</small>
      </div>
      <div class="stat">
        <span>Storage & Project</span>
        <strong>${esc(item.storage||'General')}</strong>
        <small>Project: ${esc(item.project||'General')}</small>
      </div>
    </div>

    <div class="grid" style="margin-bottom:20px">
      <section class="panel">
        <h2>Stock Health</h2>
        <div style="margin-top:12px">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span>Stock vs Minimum Target</span>
            <b>${stockRatio}%</b>
          </div>
          <div style="background:#e2e8f0;border-radius:99px;height:12px;overflow:hidden">
            <div style="width:${Math.min(100,stockRatio)}%;background:${low(item)?'#b91c1c':'#6b21a8'};height:100%"></div>
          </div>
        </div>
      </section>

      <section class="panel">
        <h2>Item Information</h2>
        <div style="font-size:13px;line-height:1.8">
          <div><b>Manufacturer:</b> ${esc(item.manufacturer||'N/A')}</div>
          <div><b>SKU:</b> ${esc(item.sku||'N/A')}</div>
          <div><b>Expiry Date:</b> ${esc(item.expiry_date||'N/A')}</div>
        </div>
      </section>
    </div>

    <div class="thread">
      <section class="panel">
        <h2>Container & Lot Ledger (FEFO Queue)</h2>
        <div class="table-wrap" style="margin-top:10px">
          <table>
            <thead><tr><th>Container Code</th><th>Lot Number</th><th>Remaining Qty</th><th>Expiry Date</th><th>Storage</th><th>Status</th></tr></thead>
            <tbody>
              ${cs.map(c=>`
                <tr>
                  <td><b>${esc(c.container_code)}</b></td>
                  <td>${esc(c.lot_number||'—')}</td>
                  <td><b>${c.quantity_remaining} ${esc(c.unit)}</b> / <small>${c.quantity_initial}</small></td>
                  <td>${esc(c.expiry_date||'—')}</td>
                  <td>${esc(c.storage||'—')}</td>
                  <td><span class="chip ${c.status==='ACTIVE'?'delivered':'closed'}">${esc(c.status)}</span></td>
                </tr>
              `).join('')||'<tr><td colspan="6" class="sub">No containers registered for this item yet.</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel">
        <h2>Consumption History</h2>
        <div class="table-wrap" style="margin-top:10px">
          <table>
            <thead><tr><th>Date</th><th>Quantity</th><th>Project</th><th>Purpose</th><th>User</th></tr></thead>
            <tbody>
              ${itemUsage.map(u=>`
                <tr>
                  <td>${new Date(u.created_at).toLocaleString()}</td>
                  <td><b>${u.quantity} ${esc(u.unit)}</b></td>
                  <td>${esc(u.project||'—')}</td>
                  <td>${esc(u.purpose||'—')}</td>
                  <td>${esc(u.used_by||'Member')}</td>
                </tr>
              `).join('')||'<tr><td colspan="5" class="sub">No usage recorded for this item yet.</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;

  $('#btnBackInv').onclick=()=>{page='inventory';render()};
  $$('[data-use]').forEach(b=>b.onclick=()=>usageModal(+b.dataset.use));
  $$('[data-adj]').forEach(b=>b.onclick=()=>adjustModal(+b.dataset.adj));
  $$('[data-doc]').forEach(b=>b.onclick=()=>documentsModal('inventory',b.dataset.doc));
  $$('[data-lab]').forEach(b=>b.onclick=()=>printItem(+b.dataset.lab));
}

function notificationsPage(){
  const allNotifs=getNotifications();
  const filteredNotifs=showAckNotifs ? allNotifs : allNotifs.filter(n=>!n.ack);

  $('#page').innerHTML=`
    <div class="page-head">
      <div>
        <h1>Notification Center</h1>
        <p>Per-user persistent alert acknowledgements enforced via Supabase RLS.</p>
      </div>
      <div>
        <label style="display:flex;align-items:center;gap:8px;font-weight:normal;margin:0;cursor:pointer">
          <input type="checkbox" id="chkShowAck" ${showAckNotifs?'checked':''}>
          Show Acknowledged Alerts
        </label>
      </div>
    </div>

    <div class="thread">
      ${filteredNotifs.map(n=>`
        <div class="notif-card ${n.type} ${n.ack?'ack':''}">
          <div>
            <div style="font-weight:700;font-size:15px">${esc(n.title)} ${n.ack?'<span class="sub">(Acknowledged)</span>':''}</div>
            <div class="sub" style="margin-top:4px;font-size:13px;color:#475569">${esc(n.message)}</div>
          </div>
          <div class="actions">
            ${n.actionPage?`<button data-goto="${n.actionPage}" ${n.itemId?`data-item="${n.itemId}"`:''}>View Item →</button>`:''}
            ${n.ack?`
              <button data-unack="${n.key}">Clear Ack</button>
            `:`
              <button data-ack="${n.key}" class="primary">Dismiss / Ack</button>
            `}
          </div>
        </div>
      `).join('')||`
        <div class="panel" style="text-align:center;padding:40px;color:var(--muted)">
          <h3>🎉 No active notifications</h3>
          <p>All laboratory alerts have been acknowledged or resolved.</p>
        </div>
      `}
    </div>
  `;

  $('#chkShowAck').onchange=e=>{showAckNotifs=e.target.checked;notificationsPage()};
  $$('[data-ack]').forEach(b=>b.onclick=async()=>{
    try{
      await api.acknowledgeNotification(profile.lab_id, user.id, b.dataset.ack);
      toast('Notification acknowledged');
      await refresh();
    }catch(e){fail(e)}
  });
  $$('[data-unack]').forEach(b=>b.onclick=async()=>{
    try{
      await api.clearNotificationAck(profile.lab_id, user.id, b.dataset.unack);
      toast('Acknowledgement cleared');
      await refresh();
    }catch(e){fail(e)}
  });
  $$('[data-goto]').forEach(b=>b.onclick=()=>{
    page=b.dataset.goto;
    if(b.dataset.item){selectedItemId=+b.dataset.item;page='inventory_detail';}
    render();
  });
}

function procurement(){const rows=db.procurement.filter(r=>!search||JSON.stringify(r).toLowerCase().includes(search));$('#page').innerHTML=`<div class="page-head"><div><h1>Procurement</h1><p>Request → order → receive → reconcile → close.</p></div><button class="primary" id="newReq2">+ New Request</button></div><div class="thread">${rows.map(r=>{const v=db.vendors.find(x=>x.id===r.vendor_id);const who=r.requester_name||'Lab member';return `<article class="request"><div class="req-head"><div><b>${esc(v?.name||who)}</b><div class="sub">${new Date(r.created_at).toLocaleDateString()}</div></div>${chip(r.status)}</div><span class="project">${esc(r.project||'General')}</span>${r.items.map(i=>{const inv=db.inventory.find(x=>x.id===i.inventory_id);return `<div class="itemrow"><span>${esc(inv?.name||i.item_name||'Item')}</span><b>${i.received_quantity||0}/${i.quantity} ${esc(i.unit)}</b></div>`}).join('')}<div class="sub">Needed ${esc(r.needed_by||'—')} ${r.po_number?`· ${esc(r.po_number)}`:''}</div><div class="actions" style="margin-top:10px">${admin()&&r.status==='Requested'?`<button data-order="${r.id}">Create Order</button>`:''}${admin()&&['Ordered','Partial'].includes(r.status)?`<button data-rec="${r.id}">Receive</button>`:''}${admin()&&r.status==='Delivered'?`<button data-inv="${r.id}">Invoice</button><button data-close="${r.id}">Close</button>`:''}<button data-docreq="${r.id}">Docs</button>${r.po_number?`<button data-po="${r.id}">Print PO</button>`:''}</div></article>`}).join('')}</div>`;$('#newReq2').onclick=requestModal;$$('[data-order]').forEach(b=>b.onclick=()=>orderModal(+b.dataset.order));$$('[data-rec]').forEach(b=>b.onclick=()=>receiveModal(+b.dataset.rec));$$('[data-inv]').forEach(b=>b.onclick=()=>invoiceModal(+b.dataset.inv));$$('[data-close]').forEach(b=>b.onclick=async()=>{try{await api.closeRequest(+b.dataset.close);toast('Closed');await refresh()}catch(e){fail(e)}});$$('[data-docreq]').forEach(b=>b.onclick=()=>documentsModal('request',b.dataset.docreq));$$('[data-po]').forEach(b=>b.onclick=()=>printPO(+b.dataset.po))}
function vendors(){const rows=db.vendors.filter(v=>!search||JSON.stringify(v).toLowerCase().includes(search));$('#page').innerHTML=`<div class="page-head"><div><h1>Vendors</h1><p>Supplier contacts and procurement partners.</p></div>${admin()?'<button class="primary" id="addVendor">+ Add Vendor</button>':''}</div><div class="vendor-grid">${rows.map(v=>`<div class="card"><h3>${esc(v.name)}</h3><p>${esc(v.contact||'')}</p><div class="sub">${esc(v.email||'')}<br>${esc(v.phone||'')}<br>${esc(v.city||'')}<br>★ ${v.rating||'—'}</div></div>`).join('')}</div>`;if(admin())$('#addVendor').onclick=vendorModal}
function analytics(){const cats={},projects={};db.inventory.forEach(x=>cats[x.category]=(cats[x.category]||0)+Number(x.current_stock||0)*Number(x.unit_cost||0));db.procurement.forEach(r=>projects[r.project]=(projects[r.project]||0)+Number(r.ordered_total||0));const reorder=db.inventory.filter(low).map(x=>({...x,recommended_order:Math.max(1,Math.ceil(Number(x.min_stock)*2-Number(x.current_stock)))}));$('#page').innerHTML=`<div class="page-head"><div><h1>Analytics</h1><p>Live summaries from the shared Supabase dataset.</p></div></div><div class="grid"><section class="panel"><h2>Reorder suggestions</h2>${reorder.map(x=>`<div class="auditrow"><b>${esc(x.name)}</b><span style="float:right">Order ${x.recommended_order} ${esc(x.unit)}</span></div>`).join('')||'No suggestions'}</section><section class="panel"><h2>Inventory value</h2>${Object.entries(cats).map(([k,v])=>`<div class="auditrow"><b>${esc(k)}</b><span style="float:right">${money(v)}</span></div>`).join('')}</section><section class="panel"><h2>Project spend</h2>${Object.entries(projects).map(([k,v])=>`<div class="auditrow"><b>${esc(k)}</b><span style="float:right">${money(v)}</span></div>`).join('')}</section><section class="panel"><h2>Usage</h2>${db.usage.slice(0,15).map(u=>`<div class="auditrow"><b>${esc(u.item_name||'Inventory use')}</b><span style="float:right">${u.quantity} ${esc(u.unit||'')}</span><div class="sub">${esc(u.project||'')} · ${esc(u.purpose||'')}</div></div>`).join('')||'No usage yet'}</section></div>`}
function settings(){$('#page').innerHTML=`<div class="page-head"><div><h1>Settings</h1><p>Supabase connection, laboratory profile and audit history.</p></div><button id="logout">Sign out</button></div><div class="grid"><section class="panel"><h2>Account</h2><b>${esc(profile.display_name||user.email)}</b><p class="sub">${esc(user.email)} · ${esc(profile.role)}</p><div class="notice">Authorization is enforced by Supabase Row Level Security, not by hidden buttons in this page.</div></section><section class="panel"><h2>Laboratory</h2><b>${esc(db.lab?.name||'')}</b><p class="sub">${esc(db.lab?.address||'')}</p>${admin()?'<div class="actions"><button id="editLab">Edit</button><button id="inviteUser">Invite user</button></div>':''}</section><section class="panel"><h2>Backend</h2><p><b>Supabase connected</b></p><p class="sub">Postgres database · Auth · Storage · Realtime</p><p class="sub">Version ${VERSION}</p></section><section class="panel audit"><h2>Audit log</h2>${db.audit.map(a=>`<div class="auditrow"><b>${esc(a.action)}</b> · ${esc(a.entity_type)} #${esc(a.entity_id||'')}<div class="sub">${new Date(a.created_at).toLocaleString()} · ${esc(a.actor_email||a.actor_id||'system')}</div></div>`).join('')||'No audit events'}</section></div>`;$('#logout').onclick=async()=>{await api.signOut();showLogin()};if(admin()){ $('#editLab').onclick=labModal; $('#inviteUser').onclick=inviteUserModal }}

function itemModal(){modal('Add inventory item',`<div class="formgrid"><label>Name<input id="f_name" required></label><label>Category<input id="f_category" value="Chemical"></label><label>SKU<input id="f_sku"></label><label>CAS<input id="f_cas"></label><label>Minimum stock<input id="f_min" type="number" step="any" value="1"></label><label>Unit<input id="f_unit" value="bottles"></label><label>Storage<input id="f_storage"></label><label>Expiry<input id="f_expiry" type="date"></label><label>Project<input id="f_project" value="General"></label><label>Unit cost<input id="f_cost" type="number" step="0.01" value="0"></label><label class="full">Manufacturer<input id="f_manu"></label></div>`,async()=>{if(!$('#f_name').value.trim())throw Error('Name required');await api.addInventory(profile.lab_id,{name:$('#f_name').value.trim(),category:$('#f_category').value.trim(),sku:$('#f_sku').value.trim(),cas:$('#f_cas').value.trim()||null,min_stock:+$('#f_min').value||0,unit:$('#f_unit').value.trim(),storage:$('#f_storage').value.trim(),expiry_date:$('#f_expiry').value||null,project:$('#f_project').value.trim(),unit_cost:+$('#f_cost').value||0,manufacturer:$('#f_manu').value.trim()});toast('Item added');await refresh()})}
function vendorModal(){modal('Add vendor',`<div class="formgrid"><label>Name<input id="v_name"></label><label>Contact<input id="v_contact"></label><label>Email<input id="v_email" type="email"></label><label>Phone<input id="v_phone"></label><label>City<input id="v_city"></label><label>Rating<input id="v_rating" type="number" min="0" max="5" step="0.1" value="4"></label></div>`,async()=>{if(!$('#v_name').value.trim())throw Error('Vendor name required');await api.addVendor(profile.lab_id,{name:$('#v_name').value.trim(),contact:$('#v_contact').value.trim(),email:$('#v_email').value.trim(),phone:$('#v_phone').value.trim(),city:$('#v_city').value.trim(),rating:+$('#v_rating').value||null});toast('Vendor added');await refresh()})}
function requestModal(){if(!db.inventory.length)return toast('Add inventory first');const opts=db.inventory.map(x=>`<option value="${x.id}">${esc(x.name)} (${esc(x.unit)})</option>`).join('');modal('New procurement request',`<div class="formgrid"><label>Project<input id="r_project" value="General"></label><label>Needed by<input id="r_need" type="date"></label><label class="full">Item<select id="r_item">${opts}</select></label><label>Quantity<input id="r_qty" type="number" min="0.0001" step="any" value="1"></label><label>Justification<input id="r_note"></label></div>`,async()=>{const inv=db.inventory.find(x=>x.id===+$('#r_item').value);await api.createRequest(profile.lab_id,user.id,{project:$('#r_project').value.trim(),needed_by:$('#r_need').value||null,status:'Requested',justification:$('#r_note').value.trim()},[{inventory_id:inv.id,quantity:+$('#r_qty').value,received_quantity:0,unit:inv.unit}]);toast('Request created');await refresh()},'Create request')}
function orderModal(id){const vo=db.vendors.map(v=>`<option value="${v.id}">${esc(v.name)}</option>`).join('');modal('Create order',`<div class="formgrid"><label>Vendor<select id="o_vendor">${vo}</select></label><label>Expected date<input id="o_date" type="date"></label><label class="full">Order total<input id="o_total" type="number" min="0" step="0.01"></label></div>`,async()=>{await api.placeOrder(id,+$('#o_vendor').value,$('#o_date').value,+$('#o_total').value);toast('Order created');await refresh()},'Place order')}
function receiveModal(id){const r=db.procurement.find(x=>x.id===id);modal('Receive items',`<div class="formgrid">${r.items.map(i=>{const inv=db.inventory.find(x=>x.id===i.inventory_id),remain=Number(i.quantity)-Number(i.received_quantity||0);return `<div class="full panel"><b>${esc(inv?.name||'Item')}</b><div class="formgrid"><label>Receive now<input data-q="${i.id}" type="number" min="0" max="${remain}" step="any" value="${remain}"></label><label>Lot<input data-lot="${i.id}"></label><label>Expiry<input data-exp="${i.id}" type="date" value="${esc(inv?.expiry_date||'')}"></label></div></div>`}).join('')}</div>`,async()=>{const lines=r.items.map(i=>({procurement_item_id:i.id,qty:+document.querySelector(`[data-q="${i.id}"]`).value||0,lot_number:document.querySelector(`[data-lot="${i.id}"]`).value.trim(),expiry_date:document.querySelector(`[data-exp="${i.id}"]`).value||null})).filter(x=>x.qty>0);if(!lines.length)throw Error('Enter quantity to receive');await api.receiveRequest(id,lines);toast('Receipt recorded');await refresh()},'Receive')}
function usageModal(id){const x=db.inventory.find(i=>i.id===id),cs=db.containers.filter(c=>c.inventory_id===id&&c.status==='ACTIVE'&&Number(c.quantity_remaining)>0);modal(`Use ${x.name}`,`<div class="formgrid"><label>Quantity (${esc(x.unit)})<input id="u_qty" type="number" min="0.0001" step="any" value="1"></label><label>Container<select id="u_cont"><option value="">Automatic FEFO</option>${cs.map(c=>`<option value="${c.id}">${esc(c.container_code)} · ${c.quantity_remaining} · exp ${esc(c.expiry_date||'—')}</option>`).join('')}</select></label><label>Project<input id="u_proj" value="${esc(x.project||'')}"></label><label>Purpose<input id="u_purp"></label></div>`,async()=>{await api.consumeInventory(id,+$('#u_qty').value,$('#u_proj').value,$('#u_purp').value,$('#u_cont').value||null);toast('Usage recorded');await refresh()},'Record usage')}
function adjustModal(id){const x=db.inventory.find(i=>i.id===id);modal(`Adjust ${x.name}`,`<div class="formgrid"><label>New total stock<input id="a_stock" type="number" step="any" value="${x.current_stock}"></label><label>Reason<input id="a_reason" value="Stocktake correction"></label></div>`,async()=>{await api.adjustInventory(id,+$('#a_stock').value,$('#a_reason').value);toast('Stock adjusted');await refresh()})}
function invoiceModal(id){const r=db.procurement.find(x=>x.id===id);modal('Invoice reconciliation',`<div class="formgrid"><label>PO total<input value="${r.ordered_total||0}" disabled></label><label>Invoice amount<input id="i_amt" type="number" step="0.01" value="${r.invoice_amount??r.ordered_total??0}"></label><label>Invoice reference<input id="i_ref" value="${esc(r.invoice_ref||'')}"></label><label>Payment<select id="i_pay"><option>Unpaid</option><option>Paid</option><option>Partially Paid</option></select></label></div>`,async()=>{await api.updateInvoice(id,$('#i_amt').value,$('#i_ref').value,$('#i_pay').value);toast('Invoice updated');await refresh()})}
function containersModal(id){const x=db.inventory.find(i=>i.id===id),cs=db.containers.filter(c=>c.inventory_id===id);modal(`${x.name} containers`,`<div class="table-wrap"><table><thead><tr><th>Code</th><th>Lot</th><th>Remaining</th><th>Expiry</th><th>Status</th></tr></thead><tbody>${cs.map(c=>`<tr><td><b>${esc(c.container_code)}</b></td><td>${esc(c.lot_number||'—')}</td><td>${c.quantity_remaining} ${esc(c.unit)}</td><td>${esc(c.expiry_date||'—')}</td><td>${esc(c.status)}</td></tr>`).join('')}</tbody></table></div>`,async()=>{},'Close');$('#ms').onclick=()=>$('#modal').innerHTML=''}
async function documentsModal(type,id){try{const docs=await api.listAttachments(profile.lab_id,type,id);modal('Documents',`<div class="formgrid"><label class="full">Upload file<input id="d_file" type="file"></label></div><div style="margin-top:16px">${docs.map(d=>`<div class="auditrow"><button data-open="${d.id}">${esc(d.file_name)}</button><div class="sub">${new Date(d.created_at).toLocaleString()} · ${Math.round((d.size_bytes||0)/1024)} KB</div></div>`).join('')||'<div class="sub">No documents yet.</div>'}</div>`,async()=>{const f=$('#d_file').files[0];if(!f)throw Error('Choose a file');await api.uploadDocument(profile.lab_id,type,id,f);toast('Uploaded')},'Upload');$$('[data-open]').forEach(b=>b.onclick=async()=>{const d=docs.find(x=>x.id===+b.dataset.open);const r=await api.signedDocumentUrl(d.storage_path);window.open(r.signedUrl,'_blank')})}catch(e){fail(e)}}

function inviteUserModal(){modal('Invite lab user',`<div class="formgrid"><label>Email<input id="iu_email" type="email" required></label><label>Display name<input id="iu_name"></label><label>Role<select id="iu_role"><option value="member">Member</option><option value="admin">Admin</option></select></label><label>Invite redirect URL<input id="iu_redirect" value="${esc(location.origin+location.pathname)}"></label></div><div class="notice full">Requires the included Supabase Edge Function <code>invite-user</code> to be deployed.</div>`,async()=>{const email=$('#iu_email').value.trim();if(!email)throw Error('Email required');await api.inviteUser(email,$('#iu_name').value.trim(),$('#iu_role').value,$('#iu_redirect').value.trim());toast('Invitation sent')},'Send invite')}
function labModal(){modal('Laboratory settings',`<div class="formgrid"><label>Name<input id="l_name" value="${esc(db.lab.name||'')}"></label><label>PO prefix<input id="l_po" value="${esc(db.lab.po_prefix||'LABB-PO')}"></label><label class="full">Address<textarea id="l_addr">${esc(db.lab.address||'')}</textarea></label><label>Expiry notice days<input id="l_days" type="number" value="${db.lab.expiry_notice_days||90}"></label><label>Reorder horizon days<input id="l_reorder" type="number" value="${db.lab.reorder_horizon_days||30}"></label></div>`,async()=>{await api.updateLab(profile.lab_id,{name:$('#l_name').value.trim(),address:$('#l_addr').value.trim(),po_prefix:$('#l_po').value.trim(),expiry_notice_days:+$('#l_days').value||90,reorder_horizon_days:+$('#l_reorder').value||30});toast('Settings saved');await refresh()})}
function scanModal(){modal('Scan barcode / QR',`<label>Scan or type code<input id="s_code" autofocus placeholder="LABB-000001 / LABC-0000001"></label>`,async()=>{let c=$('#s_code').value.trim();c=c.replace(/^labb:\/\/(inventory|container)\//,'');const i=db.inventory.find(x=>x.item_code===c||x.sku===c),ct=db.containers.find(x=>x.container_code===c);if(i){page='inventory_detail';selectedItemId=i.id;render();toast(i.name)}else if(ct){const inv=db.inventory.find(x=>x.id===ct.inventory_id);$('#modal').innerHTML='';containersModal(inv.id);toast(ct.container_code)}else throw Error('Code not found')},'Find')}
function printWindow(body){const w=window.open('','_blank');if(!w)return toast('Allow popups');w.document.write(`<html><head><style>body{font-family:Arial;padding:32px}.label{width:360px;border:2px solid #111;padding:18px}.code{font:700 24px monospace;letter-spacing:2px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #aaa;padding:8px}</style></head><body>${body}<script>setTimeout(()=>print(),250)<\/script></body></html>`);w.document.close()}
function printItem(id){const x=db.inventory.find(i=>i.id===id);printWindow(`<div class="label"><h2>${esc(x.name)}</h2><div class="code">${esc(x.item_code)}</div><p>${esc(x.sku||'')} · ${esc(x.storage||'')}</p><small>labb://inventory/${esc(x.item_code)}</small></div>`)}
function printPO(id){const r=db.procurement.find(x=>x.id===id),v=db.vendors.find(x=>x.id===r.vendor_id);printWindow(`<h1>${esc(db.lab.name)}</h1><p>${esc(db.lab.address||'')}</p><h2>${esc(r.po_number)}</h2><p>Vendor: ${esc(v?.name||'—')} · Project: ${esc(r.project||'')}</p><table><tr><th>Item</th><th>Qty</th><th>Unit</th></tr>${r.items.map(i=>{const inv=db.inventory.find(x=>x.id===i.inventory_id);return `<tr><td>${esc(inv?.name||'Item')}</td><td>${i.quantity}</td><td>${esc(i.unit)}</td></tr>`}).join('')}</table><h3>Total ${money(r.ordered_total)}</h3>`)}

if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
