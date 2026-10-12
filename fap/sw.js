const SHELL = 'fap-shell-v1', DATA = 'fap-data';
const FILES = ['./', 'index.html', 'app.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== SHELL && k !== DATA).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url); if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname.endsWith('/data/index.json')) {           // реестр: сначала сеть, офлайн — из кэша
    e.respondWith(fetch(e.request).then(r => { caches.open(DATA).then(c => c.put(u.pathname, r.clone())); return r; }).catch(() => caches.match(u.pathname)));
  } else if (u.pathname.includes('/data/docs/')) {          // тексты: кэш, обновление в фоне
    e.respondWith(caches.open(DATA).then(async c => { const hit = await c.match(u.pathname);
      const net = fetch(e.request).then(r => { if (r.ok) c.put(u.pathname, r.clone()); return r; });
      return hit ? (net.catch(() => {}), hit) : net; }));
  } else {
    e.respondWith(caches.match(e.request).then(h => h || fetch(e.request)));
  }
});
