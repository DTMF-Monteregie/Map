// Service worker — PTEM 2027 (cliniques en recrutement, Montérégie)
// IMPORTANT : à chaque déploiement, incrémenter CACHE (v2 → v3 …) pour purger l'ancien cache.
// v29 (20 août 2026) : ajout de la page dédiée Montérégie-Est (voir MODE_EST dans index.html).
// v30 (21 août 2026) : la page Montérégie-Est devient installable comme app DISTINCTE (son
// propre manifeste manifest-est.webmanifest + ses propres icônes à point rose) — un seul
// service worker continue de tout servir, voir CORE_EST plus bas et estAccueilEst plus loin.
// v31 (22 août 2026) : plusieurs mises à jour de index.html (brillance du « est », minuterie et
// z-index des hôpitaux, garde-fou du formulaire, bannières PTEM/AMP) ont été déployées SANS
// jamais faire monter ce numéro — les visiteurs déjà passés une fois sur le site restaient donc
// coincés sur une version en cache, potentiellement plus ancienne que le code réellement en ligne
// (épingles ou bouton « Installer » figés dans l'état où ils ont été mis en cache la première
// fois). Bump systématique à chaque dépôt d'un index.html modifié, pas seulement pour les
// changements structurels du service worker lui-même.
// v32 (22 août 2026) : icônes H des hôpitaux (taille fixe, seul le z-index change après 10 s),
// bannières og:image cohérentes dans tout l'univers Est, retour du logo point BLEU partout
// (icônes PWA icon-est-*.png/apple-touch-icon-est.png remplacées), boutons RLS foncés par défaut
// (pâles seulement à l'isolement), bouton d'installation toujours visible + entrée dans le menu
// (i), correction du rognage mobile des bannières visual-banner, short_name/
// apple-mobile-web-app-title de l'univers Est alignés sur « PTEM 2027 ».
// v33 (26 août 2026, 1er essai — corrigé par v34) : en-tête — tentative de remplacer
// « RECRUTEMENT » par « Trouve ta clinique », mais avec un style et un ordre inventés plutôt
// que copiés du brouillon d'Olivier (OLaplante/Monteregie-Est) — deux essais faux d'affilée.
// v34 (26 août 2026) : bannière corrigée pour de bon — reprise EXACTE du brouillon d'Olivier,
// vérifiée diff par diff contre son code : « RECRUTEMENT » → « TROUVE TA CLINIQUE » en
// majuscules, CSS de `.brand-org` totalement inchangée (même taille, graisse, espacement,
// position au-dessus du titre). Écran de chargement toujours non touché.
// v35 (26 août 2026) : data.json enrichi de 3 RLS de la Montérégie-Ouest — Vaudreuil-Soulanges
// (11 fiches), Suroît (6 fiches) et Haut-Saint-Laurent (4 fiches), 21 nouvelles cliniques au
// total (61 → 82). Jardins-Roussillon revérifié, aucun changement. Pages SEO régénérées
// (/cliniques/, /rls/*, sitemap.xml). Aucun changement de design, filtres ou logique.
// v36 (26 août 2026) : badge « Vérifié » (sceau compact, icône seule) ajouté après le nom d'une
// clinique dont validation.statut === 'valide' dans data.json — sidebar, panneau détail, pages
// SEO individuelles, répertoire /cliniques/ et pages /rls/*. N'affecte AUCUNE fiche pour le
// moment : aucune clinique n'a encore ce champ, donc aucun badge visible tant qu'on ne l'active
// pas volontairement, fiche par fiche, après révision manuelle. Design/filtres/logique inchangés.
// v37 (26 août 2026) : data.json enrichi de 5 hôpitaux manquants — Hôpital Charles-Le Moyne et
// Hôpital du Haut-Richelieu (Montérégie-Centre), Hôpital Anna-Laberge, Hôpital du Suroît et
// Hôpital Barrie Memorial (Montérégie-Ouest). Total 3 → 8 hôpitaux (coordonnées, adresses et
// téléphones vérifiés sur santemonteregie.qc.ca). L'Hôpital de Vaudreuil-Soulanges, encore en
// construction et non ouvert, n'a PAS été ajouté. Changement de code : les hôpitaux
// s'affichent maintenant sur la carte générale des 3 territoires (auparavant réservés à la
// seule page Montérégie-Est) ; la page Montérégie-Est continue de ne montrer que les hôpitaux
// region === 'Est'. Icônes, popups, comportement de zoom/z-index inchangés.
// v38 (26 août 2026) : ajout d'un 9e hôpital — l'Hôpital de Vaudreuil-Soulanges, encore en
// chantier (ouverture prévue à l'été 2028, aucune adresse civique officielle assignée pour
// l'instant — position approximative, posApprox:true). Affiché différemment des hôpitaux en
// fonction pour éviter toute confusion : icône ambre pointillée (🚧 au lieu de « H »), infobulle
// « (en chantier) », popup avec mention explicite « Pas encore ouvert […] Ne pas s'y présenter »
// et sans numéro de téléphone. Nouveau champ data.json optionnel : statut:'construction' (+
// ouverturePrevue). N'affecte aucun autre hôpital ni aucune clinique.
// v39 (26 août 2026) : ouverture des cartes MONTÉRÉGIE-CENTRE et MONTÉRÉGIE-OUEST, sur le même
// principe que la carte Montérégie-Est — /monteregie-centre/ et /monteregie-ouest/, chacune
// filtrée sur son territoire (cliniques ET hôpitaux), épingles colorées par RLS, mot manuscrit
// du territoire sur l'écran de chargement et dans l'en-tête (vert pour le Centre, bleu pour
// l'Ouest), et univers SEO étanche (/rls/*, /cliniques/*, /ptem/, /amp/). Ce ne sont PAS des
// applications installables : contrairement à l'Est, elles n'ont ni manifeste ni icônes propres
// et leurs boutons « Installer » sont retirés (décision d'Olivier). Autres changements de la
// même passe : le menu « i » de la carte générale mène désormais aux trois cartes régionales,
// le titre « CLINIQUES EN RECRUTEMENT » reçoit un trait de couleur (dégradé turquoise sur la
// carte générale, couleur du territoire sur une carte régionale), et le délai avant que les
// repères « H » des hôpitaux repassent à l'arrière-plan passe de 10 à 5 secondes.
// v40 (27 août 2026) : CARTO exige désormais une clé API pour ses fonds raster (light_all /
// dark_all) — ajout de ?key=… à l'URL des tuiles dans index.html (et donc dans les copies
// régionales, qui en héritent via scripts/publier-regions.js). Aucun autre changement ; même
// styles de carte qu'avant (pas de bascule vers Voyager).
// v41 (27 août 2026) : passage du fond de carte de raster à VECTORIEL sur les 4 cartes
// (générale + les 3 régionales) — reprise exacte de l'intégration déjà en place sur le brouillon
// Montérégie-Est (OLaplante/Monteregie-Est) : MapLibre GL JS 5.24.0 + adaptateur MapLibre GL
// Leaflet 0.1.4, fichiers vendor copiés tels quels. Styles CARTO Positron (clair) et Dark Matter
// (sombre), même clé API. Leaflet garde toute la main sur les épingles, popups, filtres,
// favoris, géolocalisation et contrôles — MapLibre ne dessine QUE le fond. Le fond raster avec
// clé (v40) reste en solution de secours si WebGL est indisponible. Trois fichiers vendor
// ajoutés au cache. Aucun changement de données, de marqueurs, de filtres, de texte ou de mise
// en page.
// v42 (28 août 2026) : ajout des trois repères territoriaux CISSS sur la carte générale,
// à partir des limites RLS officielles MSSS 2026. Aucun changement aux pages régionales.
const CACHE = 'ptem-2027-v42';
const CORE = [
  './',
  './index.html',
  './territoires-monteregie.js',
  './leaflet.css',
  './leaflet.js',
  './vendor/maplibre-gl.css',
  './vendor/maplibre-gl.js',
  './vendor/leaflet-maplibre-gl.js',
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

// Pages régionales : mises en cache À PART, et de façon tolérante. cache.addAll() échoue EN BLOC
// si un seul de ses fichiers manque — si /monteregie-est/ n'était pas encore déposé (ou venait à
// être retiré), l'installation entière échouerait et TOUT le mode hors ligne disparaîtrait, y
// compris pour la carte principale. On les ajoute donc séparément, et un échec ici ne fait
// perdre que le hors-ligne de la page concernée.
// Le manifeste et les icônes d'installation de la Montérégie-Est en font partie depuis le
// 21 août — sans quoi l'installation de cette app échouerait hors ligne. Le Centre et l'Ouest
// (26 août) n'ont ni manifeste ni icônes : ce sont des cartes, pas des applications.
const CORE_REGIONS = [
  './monteregie-est/', './monteregie-est/index.html',
  './monteregie-centre/', './monteregie-centre/index.html',
  './monteregie-ouest/', './monteregie-ouest/index.html',
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
        .then(() => Promise.allSettled(CORE_REGIONS.map(u => cache.add(u)))))
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
  // QUATRE « accueils » depuis le 26 août 2026 : la carte des trois territoires et les trois
  // cartes régionales (Est depuis le 20 août, Centre et Ouest depuis le 26). Ce sont QUATRE
  // documents distincts (contenu filtré différemment), donc quatre clés de cache distinctes —
  // voir cacheKey plus bas. Les confondre reviendrait à servir hors ligne la carte des trois
  // territoires à quelqu'un qui a ouvert une page régionale, ou pire, la carte d'un autre
  // territoire que celui qu'il a demandé.
  const REGIONS = ['monteregie-est', 'monteregie-centre', 'monteregie-ouest'];
  const memeOrigine = url.origin === self.location.origin;
  const estAccueilPrincipal = memeOrigine
    && (url.pathname === '/' || url.pathname === '/index.html');
  const regionAccueil = memeOrigine
    ? REGIONS.find(r => url.pathname === `/${r}/` || url.pathname === `/${r}/index.html`) || null
    : null;
  const estAccueil = estAccueilPrincipal || regionAccueil !== null;

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
    const cacheKey = regionAccueil ? `./${regionAccueil}/index.html`
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
      // page régionale demandée — un secours pire que la panne dans ce cas précis.
      .catch(() => caches.match(cacheKey).then(m => m || (regionAccueil ? undefined : caches.match('./index.html'))))
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
