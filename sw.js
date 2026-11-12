const V='jarvis-v1',SHELL=['/','/style.css','/app.js','/manifest.json','/icon-192.png','/icon-512.png',
'https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js','https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>Promise.allSettled(SHELL.map(u=>c.add(u)))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);if(r.method!=='GET')return;
 if(u.pathname.startsWith('/api/'))return; // AI needs internet; never cached
 e.respondWith(caches.match(r).then(h=>h||fetch(r).then(n=>{if(n.ok){const c=n.clone();caches.open(V).then(x=>x.put(r,c))}return n}).catch(()=>r.mode==='navigate'?caches.match('/'):Response.error())))});
