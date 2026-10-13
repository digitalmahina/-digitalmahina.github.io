const SHELL = 'fap-shell-v2', DATA = 'fap-data', LIB = 'fap-lib', KEEP = [SHELL, DATA, LIB, 'transformers-cache'];
const FILES = ['./', 'index.html', 'app.js', 'sem.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => !KEEP.includes(k)).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url); if (e.request.method !== 'GET') return;
  if (u.hostname === 'cdn.jsdelivr.net') {                  // библиотека нейросети: кэш навсегда (версия зафиксирована)
    e.respondWith(caches.open(LIB).then(async c => (await c.match(e.request)) || fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; })));
    return;
  }
  if (u.origin !== location.origin) return;
  if (u.pathname.endsWith('/data/index.json') || u.pathname.endsWith('/data/sem/index.json')) {           // реестр: сначала сеть, офлайн — из кэша
    e.respondWith(fetch(e.request).then(r => { caches.open(DATA).then(c => c.put(u.pathname, r.clone())); return r; }).catch(() => caches.match(u.pathname)));
  } else if (u.pathname.includes('/data/docs/') || u.pathname.includes('/data/sem/')) {          // тексты и векторы: кэш, обновление в фоне
    const key = u.pathname + u.search;
    e.respondWith(caches.open(DATA).then(async c => { const hit = await c.match(key);
      const net = fetch(e.request).then(r => { if (r.ok) c.put(key, r.clone()); return r; });
      return hit ? (net.catch(() => {}), hit) : net; }));
  } else {
    e.respondWith(caches.match(e.request).then(h => h || fetch(e.request)));
  }
});
