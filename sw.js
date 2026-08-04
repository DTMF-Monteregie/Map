// Service worker — PTEM 2027 (cliniques en recrutement, Santé Québec Montérégie)
// IMPORTANT : à chaque déploiement, incrémenter CACHE (v2 → v3 …) pour purger l'ancien cache.
const CACHE = 'ptem-2027-v8';
const CORE = [
  './',
  './index.html',
  './leaflet.css',
  './leaflet.js',
  './data.json',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-192-maskable.png',
  './icon-512-maskable.png',
  './apple-touch-icon-180.png',
  './favicon-16.png',
  './favicon-32.png',
  './favicon-48.png'
];

// Installation : mise en cache de la coquille + activation immédiate
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

// Activation : suppression des anciens caches + prise de contrôle immédiate
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isHTML = req.mode === 'navigate'
    || url.pathname.endsWith('/')
    || url.pathname.endsWith('/index.html')
    || url.pathname.endsWith('index.html');

  // index.html / navigations + data.json : RÉSEAU D'ABORD (toujours la dernière version en ligne),
  // repli sur le cache si hors-ligne.
  if (isHTML || req.url.includes('data.json')) {
    event.respondWith(
      fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(req).then(m => m || caches.match('./index.html')))
    );
    return;
  }

  // Autres ressources (leaflet, icônes…) : cache d'abord, mise à jour en arrière-plan.
  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
