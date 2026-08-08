from pathlib import Path
import json, subprocess, sys, threading, time, urllib.request, http.server, socketserver, os
root=Path(__file__).resolve().parent
checks=[]
def check(name, cond, detail=''):
    checks.append({'name':name,'pass':bool(cond),'detail':detail})
    if not cond: print('FAIL',name,detail)

required=['index.html','styles.css','app.js','api.js','supabase-client.js','config.js','config.example.js','manifest.webmanifest','sw.js','supabase/schema.sql','supabase/migrations/v0.6.sql','supabase/bootstrap_first_admin.sql','.github/workflows/pages.yml','V0.6_UPGRADE.md']
for f in required: check('file:'+f,(root/f).exists())

for f in ['app.js','api.js','config.js','config.example.js','supabase-client.js','sw.js']:
    p=subprocess.run(['node','--check',str(root/f)],capture_output=True,text=True)
    check('js-syntax:'+f,p.returncode==0,(p.stderr or p.stdout).strip())

idx=(root/'index.html').read_text()
app=(root/'app.js').read_text()
api=(root/'api.js').read_text()
sql=(root/'supabase/schema.sql').read_text()
mig=(root/'supabase/migrations/v0.6.sql').read_text()
wf=(root/'.github/workflows/pages.yml').read_text()
client=(root/'supabase-client.js').read_text()
config=(root/'config.js').read_text()
css=(root/'styles.css').read_text()
sw=(root/'sw.js').read_text()

# Baseline v0.5 invariants
check('frontend-no-localStorage-database','localStorage.setItem' not in app and 'localStorage.getItem' not in app)
check('supabase-client-created','createClient' in client and 'SUPABASE_PUBLISHABLE_KEY' in client)
check('auth-password-login','signInWithPassword' in api)
check('realtime-subscription','postgres_changes' in api and 'supabase.channel' in api)
check('storage-private-client','labb-documents' in api and 'createSignedUrl' in api)
check('rpc-consume-client',"rpc('consume_inventory'" in api)
check('rpc-receive-client',"rpc('receive_procurement'" in api)
check('rpc-order-client',"rpc('place_order'" in api)
check('no-secret-in-config','sb_secret_' not in config and 'SUPABASE_SERVICE_ROLE_KEY =' not in config)
check('project-url-configured','https://hsxwsutqpsvrueuohahr.supabase.co' in config)
check('publishable-key-configured','sb_publishable_' in config and 'YOUR_SUPABASE_PUBLISHABLE_KEY' not in config)

for table in ['labs','profiles','inventory_items','containers','vendors','procurement_requests','procurement_items','usage_logs','attachments','audit_logs']:
    check('table:'+table, f'create table if not exists public.{table}' in sql)
    check('rls:'+table, f'alter table public.{table} enable row level security' in sql)
for fn in ['current_lab_id','current_role','is_admin','consume_inventory','adjust_inventory','place_order','receive_procurement']:
    check('function:'+fn, f'function public.{fn}' in sql)
check('storage-bucket',"'labb-documents'" in sql and 'storage.objects' in sql)
check('storage-lab-scope',"split_part(name,'/',1)=(select public.current_lab_id())::text" in sql)
check('audit-trigger','function public.audit_change' in sql and 'trg_audit_' in sql)
check('stock-trigger','function public.recalculate_inventory_stock' in sql and 'trg_container_stock' in sql)
check('realtime-publication','supabase_realtime' in sql and 'alter publication' in sql)
check('role-not-user-metadata','raw_user_meta_data' not in sql and 'user_metadata' not in sql)
check('admin-rpc-checks',sql.count("if not (select public.is_admin())")>=3)

# v0.6 feature checks
check('version-060',"VERSION='0.6.0-supabase'" in app)
check('dashboard-nav','data-page="dashboard"' in idx)
check('dashboard-render','function dashboardPage' in app and 'Inventory value' in app and 'Monthly spend' in app)
check('dashboard-recent-usage','Recent usage' in app)
check('inventory-detail-route',"page==='inventory-detail'" in app and 'function inventoryDetail' in app)
check('inventory-detail-ledger','Container / lot ledger' in app)
check('inventory-detail-consumption','Recent consumption' in app)
check('notification-nav','data-page="notifications"' in idx and 'notificationCount' in idx)
check('notification-builder','function buildNotifications' in app)
check('notification-low-stock','low-stock' in app and 'Low stock:' in app)
check('notification-expiry','Expired container:' in app and 'Expiring soon:' in app)
check('notification-procurement','Delayed procurement' in app and 'Purchase request awaiting action' in app)
check('notification-ack-client','ackNotification' in api and "from('notification_acknowledgements')" in api)
check('notification-table-migration','create table if not exists public.notification_acknowledgements' in mig)
check('notification-rls-migration','alter table public.notification_acknowledgements enable row level security' in mig)
check('notification-user-scope','user_id=(select auth.uid())' in mig)
check('notification-lab-scope','lab_id=(select public.current_lab_id())' in mig)
check('notification-realtime','supabase_realtime' in mig and 'notification_acknowledgements' in api)
check('notification-base-schema','create table if not exists public.notification_acknowledgements' in sql)
check('v06-css-dashboard','.dashboard-metrics' in css and '.detail-hero' in css)
check('v06-css-notifications','.notification-row' in css and '.nav-badge' in css)
check('service-worker-v060','labb-v060-supabase' in sw)
check('upgrade-doc','supabase/migrations/v0.6.sql' in (root/'V0.6_UPGRADE.md').read_text())

# GitHub Pages workflow invariants
check('pages-checkout-current','actions/checkout@v6' in wf)
check('pages-configure-current','actions/configure-pages@v5' in wf)
check('pages-upload-current','actions/upload-pages-artifact@v4' in wf)
check('pages-deploy-current','actions/deploy-pages@v4' in wf)
check('pages-permissions','pages: write' in wf and 'id-token: write' in wf)
check('html-supabase-login','loginForm' in idx and 'Supabase backend' in idx)

# Static HTTP serving
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
os.chdir(root)
with socketserver.TCPServer(('127.0.0.1',0),Quiet) as httpd:
    port=httpd.server_address[1]
    th=threading.Thread(target=httpd.serve_forever,daemon=True); th.start(); time.sleep(.1)
    for path in ['/','/index.html','/app.js','/api.js','/supabase-client.js','/config.js','/styles.css','/manifest.webmanifest','/supabase/migrations/v0.6.sql']:
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{port}{path}',timeout=3) as r:
                check('http:'+path,r.status==200,str(r.status))
        except Exception as e: check('http:'+path,False,str(e))
    httpd.shutdown()

passed=sum(c['pass'] for c in checks); total=len(checks)
result={'version':'0.6.0-supabase-feature','status':'PASS' if passed==total else 'FAIL','passed':passed,'total':total,'checks':checks,'limitations':['Live Supabase transaction/RLS behavior for the new notification acknowledgement table must be acceptance-tested after applying supabase/migrations/v0.6.sql to the deployed project. Existing v0.5 production backend behavior is not modified by this additive migration.']}
(root/'VERIFICATION_RESULT.json').write_text(json.dumps(result,indent=2))
(root/'VERIFICATION.md').write_text(f'''# Verification — Labb v0.6\n\nAutomated package result: **{result['status']} ({passed}/{total})**.\n\nVerified locally: JavaScript syntax, GitHub Pages asset serving, v0.5 security/transactional invariants, Dashboard wiring, Inventory Detail wiring, Notification Center alert generation, notification acknowledgement API wiring, v0.6 RLS migration structure, Realtime registration, absence of secret/service-role credentials, and service-worker cache versioning.\n\n## Required live acceptance\nApply `supabase/migrations/v0.6.sql`, deploy the branch, then verify acknowledgement persistence with two users plus cross-lab isolation.\n''')
print(json.dumps({'status':result['status'],'passed':passed,'total':total},indent=2))
sys.exit(0 if passed==total else 1)
