const C='labb-v051-supabase';

const A=['./','./index.html','./styles.css','./app.js','./api.js','./supabase-client.js','./manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(A))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x))))));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.origin!==self.location.origin || u.pathname.endsWith('/config.js')) return;
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});
