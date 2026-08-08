from pathlib import Path
import json, re, subprocess, sys, threading, time, urllib.request, http.server, socketserver, os
root=Path(__file__).resolve().parent
checks=[]
def check(name, cond, detail=''):
    checks.append({'name':name,'pass':bool(cond),'detail':detail})
    if not cond: print('FAIL',name,detail)

required=['index.html','styles.css','app.js','api.js','supabase-client.js','config.js','config.example.js','manifest.webmanifest','sw.js','supabase/schema.sql','supabase/bootstrap_first_admin.sql','.github/workflows/pages.yml']
for f in required: check('file:'+f,(root/f).exists())

# JavaScript parse checks for local modules that Node can parse without resolving browser imports.
for f in ['app.js','api.js','config.js','config.example.js']:
    p=subprocess.run(['node','--check',str(root/f)],capture_output=True,text=True)
    check('js-syntax:'+f,p.returncode==0,(p.stderr or p.stdout).strip())

idx=(root/'index.html').read_text(encoding='utf-8')
app=(root/'app.js').read_text(encoding='utf-8')
api=(root/'api.js').read_text(encoding='utf-8')
sql=(root/'supabase/schema.sql').read_text(encoding='utf-8')
wf=(root/'.github/workflows/pages.yml').read_text(encoding='utf-8')
client=(root/'supabase-client.js').read_text(encoding='utf-8')
config=(root/'config.js').read_text(encoding='utf-8')


check('frontend-no-localStorage-database','localStorage.setItem' not in app and 'localStorage.getItem' not in app)
check('supabase-client-created','createClient' in client and 'SUPABASE_PUBLISHABLE_KEY' in client)
check('auth-password-login','signInWithPassword' in api)
check('realtime-subscription','postgres_changes' in api and 'supabase.channel' in api)
check('storage-private-client','labb-documents' in api and 'createSignedUrl' in api)
check('rpc-consume-client',"rpc('consume_inventory'" in api)
check('rpc-receive-client',"rpc('receive_procurement'" in api)
check('rpc-order-client',"rpc('place_order'" in api)
check('no-secret-value-in-config','sb_secret_' not in config and 'SUPABASE_SERVICE_ROLE_KEY =' not in config)
check('project-url-configured', 'https://hsxwsutqpsvrueuohahr.supabase.co' in config)
check('publishable-key-configured', 'sb_publishable_' in config)


for table in ['labs','profiles','inventory_items','containers','vendors','procurement_requests','procurement_items','usage_logs','attachments','audit_logs']:
    check('table:'+table, f'create table if not exists public.{table}' in sql)
    check('rls:'+table, f'alter table public.{table} enable row level security' in sql)
for fn in ['current_lab_id','current_role','is_admin','consume_inventory','adjust_inventory','place_order','receive_procurement']:
    check('function:'+fn, f'function public.{fn}' in sql)
check('storage-bucket', "'labb-documents'" in sql and 'storage.objects' in sql)
check('storage-lab-scope', "split_part(name,'/',1)=(select public.current_lab_id())::text" in sql)
check('audit-trigger','function public.audit_change' in sql and 'trg_audit_' in sql)
check('stock-trigger','function public.recalculate_inventory_stock' in sql and 'trg_container_stock' in sql)
check('realtime-publication','supabase_realtime' in sql and 'alter publication' in sql)
check('role-not-user-metadata','raw_user_meta_data' not in sql and 'user_metadata' not in sql)
check('admin-rpc-checks',sql.count("if not (select public.is_admin())")>=3)

check('pages-checkout-current','actions/checkout@v6' in wf)
check('pages-configure-current','actions/configure-pages@v5' in wf)
check('pages-upload-current','actions/upload-pages-artifact@v4' in wf)
check('pages-deploy-current','actions/deploy-pages@v4' in wf)
check('pages-permissions','pages: write' in wf and 'id-token: write' in wf)
check('html-supabase-login','loginForm' in idx and 'Supabase backend' in idx)

# Serve package and verify static routes over HTTP.
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
os.chdir(root)
with socketserver.TCPServer(('127.0.0.1',0),Quiet) as httpd:
    port=httpd.server_address[1]
    th=threading.Thread(target=httpd.serve_forever,daemon=True); th.start()
    time.sleep(.1)
    for path in ['/','/index.html','/app.js','/api.js','/supabase-client.js','/config.js','/styles.css','/manifest.webmanifest']:
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{port}{path}',timeout=3) as r:
                check('http:'+path,r.status==200,str(r.status))
        except Exception as e: check('http:'+path,False,str(e))
    httpd.shutdown()

passed=sum(c['pass'] for c in checks); total=len(checks)
result={'version':'0.5.1-supabase-project-configured','status':'PASS' if passed==total else 'FAIL','passed':passed,'total':total,'checks':checks,'limitations':['Supabase project URL is configured, but the publishable/anon key is still required before live Auth/RLS/RPC/Storage verification can run.']}
(root/'VERIFICATION_RESULT.json').write_text(json.dumps(result,indent=2),encoding='utf-8')

print(json.dumps({'status':result['status'],'passed':passed,'total':total},indent=2))
sys.exit(0 if passed==total else 1)
