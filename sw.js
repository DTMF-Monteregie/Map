// Service worker — PTEM 2027 (cliniques en recrutement, Montérégie)
// IMPORTANT : à chaque déploiement, incrémenter CACHE (v2 → v3 …) pour purger l'ancien cache.
const CACHE = 'ptem-2027-v28';
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

  // QU'EST-CE QUI APPARTIENT À L'APPLICATION? Uniquement l'accueil : "/" et "/index.html",
  // avec ou sans paramètre "?c=<id>" (lien direct vers une fiche, qui ouvre le même document).
  // Tout le reste du domaine — /ptem/, /amp/, /cliniques/, /cliniques/<clinique>/, /rls/<rls>/,
  // et toute page de contenu ajoutée plus tard — est un document HTML indépendant.
  //
  // Cette règle est VOLONTAIREMENT générique (19 août 2026, 3e passe) : elle remplace une liste
  // de chemins écrits un par un, qu'il fallait penser à allonger à chaque nouvelle page — un
  // oubli aurait suffi à réintroduire le bug ci-dessous. Il n'y a maintenant plus rien à
  // maintenir ici quand on ajoute une page.
  const estAccueil = url.origin === self.location.origin
    && (url.pathname === '/' || url.pathname === '/index.html');

  // Navigation vers une page statique autre que l'accueil : on ne l'intercepte pas du tout.
  // Sans cela, la clé de cache normalisée ci-dessous écraserait le cache hors-ligne de
  // l'accueil avec le contenu de cette page (ou l'inverse) — bug trouvé et corrigé le 19 août.
  // Ces pages n'ont pas besoin du mode hors-ligne : contenu de référence, léger, toujours en
  // ligne.
  if (req.mode === 'navigate' && !estAccueil) return;

  // Accueil + data.json : RÉSEAU D'ABORD (toujours la dernière version en ligne),
  // repli sur le cache si hors-ligne.
  // Clé de cache normalisée pour l'accueil : un lien partagé ouvre
  // toujours le même index.html, seule sa chaîne de requête (?c=6, ?c=12…)
  // change. Mettre en cache sous req.url gardait une copie complète de la
  // page PAR LIEN — mesuré : ~190 Ko × 61 fiches possibles ≈ 11 Mo de
  // doublons jamais purgés, avec un risque d'éviction globale sur iOS
  // (favoris et notes compris) une fois le budget de stockage dépassé
  // (audit du 18 août). Une seule entrée sous ce nom fixe désormais.
  if (estAccueil || url.pathname.endsWith('data.json')) {
    const cacheKey = estAccueil ? './index.html' : req;
    event.respondWith(
      fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(cacheKey, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(cacheKey).then(m => m || caches.match('./index.html')))
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
