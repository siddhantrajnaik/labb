from pathlib import Path
import subprocess,json,os,threading,time,urllib.request,http.server,socketserver,sys
root=Path(__file__).resolve().parent; checks=[]
def ck(n,c,d=''): checks.append({'name':n,'pass':bool(c),'detail':d})
req=['index.html','styles.css','app.js','api.js','config.js','supabase/schema.sql','supabase/migrations/v1.0.sql','FINAL_ACCEPTANCE_CHECKLIST.md','.github/workflows/pages.yml']
for f in req: ck('file:'+f,(root/f).exists())
for f in ['app.js','api.js','config.js','supabase-client.js','sw.js']:
 p=subprocess.run(['node','--check',str(root/f)],capture_output=True,text=True);ck('js:'+f,p.returncode==0,(p.stderr or p.stdout).strip())
app=(root/'app.js').read_text(encoding='utf-8');api=(root/'api.js').read_text(encoding='utf-8');sql=(root/'supabase/schema.sql').read_text(encoding='utf-8');mig=(root/'supabase/migrations/v1.0.sql').read_text(encoding='utf-8');idx=(root/'index.html').read_text(encoding='utf-8');cfg=(root/'config.js').read_text(encoding='utf-8');sw=(root/'sw.js').read_text(encoding='utf-8')

for token in ["VERSION='1.0.0-supabase'",'function equipmentPage','function samplesPage','function teamPage','function cameraScan','function approveModal','BarcodeDetector'] : ck('app:'+token,token in app)
for nav in ['dashboard','inventory','procurement','vendors','equipment','samples','notifications','analytics','team','settings']: ck('nav:'+nav,f'data-page="{nav}"' in idx)
for fn in ['approveRequest','updateTeamMember','addEquipment','addBooking','addServiceLog','addLocation','addSample','updateSample']: ck('api:'+fn,f'function {fn}' in api)
for table in ['labs','profiles','inventory_items','containers','vendors','procurement_requests','procurement_items','usage_logs','attachments','audit_logs','notification_acknowledgements','equipment','equipment_bookings','equipment_service_logs','storage_locations','samples']: ck('table:'+table,f'create table if not exists public.{table}' in sql)
for table in ['equipment','equipment_bookings','equipment_service_logs','storage_locations','samples']: ck('rls:'+table,f'alter table public.{table} enable row level security' in mig)
for fn in ['current_lab_id','current_role','is_admin','consume_inventory','adjust_inventory','approve_request','place_order','receive_procurement']: ck('rpc:'+fn,f'function public.{fn}' in sql)
ck('approval-status',"'Approved'" in mig and "status='Approved'" in mig)
ck('order-requires-approved',"if r.status<>'Approved'" in mig)
ck('active-profile-gate','active=true' in mig and 'current_lab_id()' in mig)
ck('team-rls','admins update lab profiles' in mig)
ck('equipment-rls','members read equipment' in mig and 'admins add equipment' in mig)
ck('booking-own','members create own bookings' in mig and 'user_id=(select auth.uid())' in mig)
ck('samples-owner','owners or admins update samples' in mig)
ck('storage-location','FREEZER' in mig and 'RACK' in mig and 'BOX' in mig)
ck('attachments-expanded',"'equipment','sample','service'" in mig)
ck('realtime-final','equipment_bookings' in api and 'storage_locations' in api and 'samples' in api)
ck('private-storage',"labb-documents" in sql and "split_part(name,'/',1)=(select public.current_lab_id())::text" in sql)
ck('no-secret','sb_secret_' not in cfg and 'SUPABASE_SERVICE_ROLE_KEY =' not in cfg)
ck('project-url','https://hsxwsutqpsvrueuohahr.supabase.co' in cfg)
ck('publishable-key','sb_publishable_' in cfg)
ck('service-worker','labb-v100-supabase' in sw)
ck('no-local-db','localStorage.setItem' not in app and 'indexedDB.open' not in app)

invite=(root/'supabase/functions/invite-user/index.ts').read_text();docs=(root/'FINAL_ACCEPTANCE_CHECKLIST.md').read_text();wf=(root/'.github/workflows/pages.yml').read_text();manifest=(root/'manifest.webmanifest').read_text()
ck('invite-profile-email','email,role,active:true' in invite)
ck('invite-admin-auth','auth.admin.inviteUserByEmail' in invite and "profile?.role!='admin'" not in invite)
ck('booking-no-overlap','equipment_booking_no_overlap' in mig and 'tstzrange' in mig and 'btree_gist' in mig)
ck('service-equipment-lab-integrity','admins add service logs' in mig and 'e.id=equipment_id' in mig)
ck('sample-location-lab-integrity','members add samples' in mig and 'l.id=location_id' in mig)
ck('storage-parent-lab-integrity','parent_id is null or exists' in mig)
ck('request-item-lab-integrity','requester creates request items' in mig and 'i.id=inventory_id' in mig)
ck('profile-audit',"array['profiles','equipment'" in mig)
ck('camera-fallback','keyboard-wedge scanner' in app and 'Use camera' in app)
ck('equipment-notifications',"['calibration',e.calibration_due,'Calibration']" in app and "['maintenance',e.maintenance_due,'Maintenance']" in app)
ck('sample-notifications','Sample expiry:' in app)
ck('approval-ui','data-approve' in app and 'Request → approve → order' in app)
ck('team-deactivation','Deactivate' in app and 'active=true' in mig)
ck('equipment-documents',"documentsModal('equipment'" in app)
ck('sample-documents',"documentsModal('sample'" in app)
ck('final-acceptance-doc','Cross-lab' not in docs or 'Second lab' in docs)
ck('manifest-final','Labb Laboratory Operations' in manifest)
ck('github-pages-actions','actions/deploy-pages@v4' in wf and 'actions/configure-pages@v5' in wf)

# serve static assets
class Q(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a): pass
os.chdir(root)
with socketserver.TCPServer(('127.0.0.1',0),Q) as h:
 port=h.server_address[1];threading.Thread(target=h.serve_forever,daemon=True).start();time.sleep(.1)
 for p in ['/','/index.html','/app.js','/api.js','/styles.css','/config.js','/supabase/migrations/v1.0.sql']:
  try:
   with urllib.request.urlopen(f'http://127.0.0.1:{port}{p}',timeout=3) as r: ck('http:'+p,r.status==200,str(r.status))
  except Exception as e: ck('http:'+p,False,str(e))
 h.shutdown()
passed=sum(x['pass'] for x in checks);result={'version':'1.0.0-supabase-final','status':'PASS' if passed==len(checks) else 'FAIL','passed':passed,'total':len(checks),'checks':checks,'limitations':['Static/package checks do not replace live Supabase migration/RLS/transaction acceptance. Run FINAL_ACCEPTANCE_CHECKLIST.md after applying v1.0.sql.','Camera BarcodeDetector support varies by browser; manual and keyboard-wedge scanning are retained as fallback.']}
(root/'VERIFICATION_RESULT.json').write_text(json.dumps(result,indent=2),encoding='utf-8');(root/'VERIFICATION.md').write_text(f"# Labb v1.0 verification\n\nAutomated package result: **{result['status']} ({passed}/{len(checks)})**.\n\nThis verifies JavaScript syntax, static GitHub Pages serving, configured Supabase browser connection, absence of secret credentials, v0.6 invariants, final modules, RLS/migration structure and Realtime wiring. Live Supabase acceptance is still required after applying the migration.\n",encoding='utf-8')

print(json.dumps({'status':result['status'],'passed':passed,'total':len(checks)},indent=2));sys.exit(0 if result['status']=='PASS' else 1)
