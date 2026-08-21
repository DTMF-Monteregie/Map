// Service worker — PTEM 2027 (cliniques en recrutement, Montérégie)
// IMPORTANT : à chaque déploiement, incrémenter CACHE (v2 → v3 …) pour purger l'ancien cache.
// v29 (20 août 2026) : ajout de la page dédiée Montérégie-Est (voir MODE_EST dans index.html).
// v30 (21 août 2026) : la page Montérégie-Est devient installable comme app DISTINCTE (son
// propre manifeste manifest-est.webmanifest + ses propres icônes à point rose) — un seul
// service worker continue de tout servir, voir CORE_EST plus bas et estAccueilEst plus loin.
const CACHE = 'ptem-2027-v30';
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

// Page dédiée Montérégie-Est : mise en cache À PART, et de façon tolérante. cache.addAll()
// échoue EN BLOC si un seul de ses fichiers manque — si /monteregie-est/ n'était pas encore
// déposé (ou venait à être retiré), l'installation entière échouerait et TOUT le mode hors
// ligne disparaîtrait, y compris pour la carte principale. On l'ajoute donc séparément, et un
// échec ici ne fait perdre que le hors-ligne de cette page-là.
// Depuis le 21 août : son manifeste et ses icônes d'installation (propres à cette page, point
// rose) en font partie — sans quoi l'installation de l'app Montérégie-Est échouerait hors ligne.
const CORE_EST = [
  './monteregie-est/', './monteregie-est/index.html',
  './manifest-est.webmanifest',
  './icon-est-192.png', './icon-est-512.png',
  './icon-est-192-maskable.png', './icon-est-512-maskable.png',
  './apple-touch-icon-est.png'
];

// Installation : mise en cache de la coquille + activation immédiate
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(CORE)
        .then(() => Promise.allSettled(CORE_EST.map(u => cache.add(u)))))
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
  // Deux « accueils » depuis le 20 août 2026 : la carte complète et la carte dédiée à la
  // Montérégie-Est. Ce sont DEUX documents distincts (contenu filtré différemment), donc deux
  // clés de cache distinctes — voir cacheKey plus bas. Les confondre reviendrait à servir hors
  // ligne la carte des trois territoires à quelqu'un qui a ouvert la page Montérégie-Est.
  const memeOrigine = url.origin === self.location.origin;
  const estAccueilPrincipal = memeOrigine
    && (url.pathname === '/' || url.pathname === '/index.html');
  const estAccueilEst = memeOrigine
    && (url.pathname === '/monteregie-est/' || url.pathname === '/monteregie-est/index.html');
  const estAccueil = estAccueilPrincipal || estAccueilEst;

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
    const cacheKey = estAccueilEst ? './monteregie-est/index.html'
                   : estAccueilPrincipal ? './index.html'
                   : req;
    event.respondWith(
      fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(cacheKey, copy)).catch(() => {});
        }
        return res;
      })
      // Hors ligne : on ne se rabat QUE sur la copie de la page demandée. L'ancien repli
      // « sinon, sers ./index.html » servirait la carte des trois territoires à la place de la
      // page Montérégie-Est — un secours pire que la panne dans ce cas précis.
      .catch(() => caches.match(cacheKey).then(m => m || (estAccueilEst ? undefined : caches.match('./index.html'))))
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
