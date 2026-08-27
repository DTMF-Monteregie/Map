#!/usr/bin/env node
/*
 * Génère monteregie-est/index.html, monteregie-centre/index.html et monteregie-ouest/index.html
 * à partir de index.html : trois copies du MÊME fichier (même appli, même CSS, même data.json,
 * même logique) — pas trois pages à maintenir à la main.
 *
 * Le comportement propre à un territoire (ne charger que les cliniques et les hôpitaux de ce
 * territoire, masquer les pastilles de région, colorer les épingles par RLS, etc.) vit
 * ENTIÈREMENT dans index.html lui-même, au chargement, via REGION_PAGE / MODE_REGION — voir le
 * commentaire à cet endroit dans index.html. Ce script-ci ne touche à rien de tout ça : il se
 * contente d'adapter ce qui doit être écrit EN DUR dans le fichier publié, c'est-à-dire
 *   1. les balises <head> qui identifient la page pour les moteurs de recherche et les aperçus
 *      de partage (titre, description, canonical, Open Graph, Twitter, JSON-LD), puisque les
 *      robots qui les lisent n'exécutent pas toujours le JavaScript ;
 *   2. le lettrage manuscrit du territoire et ses deux couleurs, qui doivent être visibles dès
 *      l'écran de chargement, donc avant l'exécution du moindre script ;
 *   3. les chemins relatifs des ressources (la page vit un dossier plus bas) ;
 *   4. le contenu du menu « i », propre à chaque territoire.
 *
 * HISTORIQUE — ce script remplace scripts/publier-monteregie-est.js (20-26 août 2026), qui ne
 * savait produire que la page Montérégie-Est. La sortie pour l'Est est identique à ce que
 * produisait l'ancien script : c'est vérifié à chaque exécution, voir la note « ISOLEMENT » plus
 * bas. Les cartes Centre et Ouest ont été ouvertes le 26 août 2026 à la demande d'Olivier.
 *
 * DIFFÉRENCE VOULUE ENTRE L'EST ET LES DEUX AUTRES : seule la Montérégie-Est s'installe comme
 * une application distincte (son propre manifeste manifest-est.webmanifest et ses propres
 * icônes, depuis le 21 août). Le Centre et l'Ouest sont des CARTES, pas des applications —
 * décision d'Olivier du 26 août : « laisse faire l'app ». Leur bouton « Installer » est donc
 * retiré, et elles n'ont ni manifeste ni icônes propres. C'est le champ `app` de chaque
 * territoire ci-dessous qui décide.
 *
 * Appelé automatiquement par .github/workflows/generer-pages-seo.yml à chaque modification de
 * index.html. Se lance aussi à la main pour tester en local : node scripts/publier-regions.js
 *
 * Si un des textes ci-dessous ne se retrouve plus tel quel dans index.html (parce que le titre,
 * la description ou le JSON-LD ont été modifiés depuis), le script s'arrête en erreur plutôt que
 * de publier une copie régionale avec un texte générique erroné — mieux vaut une régénération
 * qui échoue bruyamment qu'une page publiée avec la mauvaise information.
 */
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');

/* ════════════════════════════════════════════════════════════════════════════════════════════
 * LES TROIS TERRITOIRES
 * Tout ce qui distingue une page régionale d'une autre tient dans cet objet. Ajouter un
 * territoire = ajouter une entrée ici, rien d'autre dans ce fichier.
 *
 *   dossier   : nom du dossier publié, en minuscules sans accent (règle d'adressage fixée par
 *               Olivier le 26 août : « minuscules et sans accents pour éviter les problèmes
 *               techniques et SEO »). C'est AUSSI ce que index.html reconnaît au chargement
 *               (voir REGION_PAGE) — les deux doivent rester d'accord.
 *   nom       : « Montérégie-Est » — pour les titres, descriptions et libellés.
 *   mot       : le lettrage manuscrit, en minuscules (« est », « centre », « ouest »).
 *   couleur   : teinte du lettrage et du trait sous « CLINIQUES EN RECRUTEMENT ». Éclaircie
 *               pour rester lisible sur le bleu marine de l'en-tête, sauf pour le trait, qui
 *               est sur fond crème et prend la couleur pleine du territoire (voir `accent`).
 *   halo      : la même couleur en rgba, pour l'ombre lumineuse du lettrage.
 *   accent    : couleur PLEINE du territoire (celle des épingles sur la carte générale), pour
 *               le trait sous le titre de la liste.
 *   rls       : [nom du RLS, couleur] dans l'ordre de la légende de la carte — sert à écrire
 *               les liens du menu « i ». Doit refléter RLS_COLORS_PAR_REGION dans index.html.
 *   recrutement : page « À propos du recrutement » propre au territoire, si elle existe.
 *   app       : true = page installable avec son propre manifeste (Est seulement).
 *   banniere  : image d'aperçu de partage, si le territoire en a une.
 * ══════════════════════════════════════════════════════════════════════════════════════════ */
const TERRITOIRES = [
  {
    dossier: 'monteregie-est',
    nom: 'Montérégie-Est',
    mot: 'est',
    couleur: '#ff3d96',
    halo: 'rgba(230,0,126,.8)',
    accent: '#e6007e',
    rls: [
      ['Pierre-Boucher',    '#ee2d62', 'pierre-boucher'],
      ['Richelieu-Yamaska', '#15803d', 'richelieu-yamaska'],
      ['Pierre-De Saurel',  '#2f4a7a', 'pierre-de-saurel']
    ],
    recrutement: 'https://www.santemonteregie.qc.ca/est/recrutement-medical-monteregie-est',
    app: true,
    banniere: {
      url: 'https://trouvetaclinique.ca/assets/banniere_monteregie-est.png',
      largeur: '1600', hauteur: '400',
      alt: 'Carte interactive Montérégie-Est — Trouve ta clinique.'
    }
  },
  {
    dossier: 'monteregie-centre',
    nom: 'Montérégie-Centre',
    mot: 'centre',
    couleur: '#5fd968',
    halo: 'rgba(67,160,71,.85)',
    accent: '#43a047',
    rls: [
      ['Champlain',               '#0080d7', 'champlain'],
      ['Haut-Richelieu–Rouville', '#43a047', 'haut-richelieu-rouville']
    ],
    recrutement: null,
    app: false,
    banniere: null
  },
  {
    dossier: 'monteregie-ouest',
    nom: 'Montérégie-Ouest',
    mot: 'ouest',
    couleur: '#3db4ff',
    halo: 'rgba(0,128,215,.85)',
    accent: '#0080d7',
    rls: [
      ['Jardins-Roussillon',    '#0080d7', 'jardins-roussillon'],
      ['Vaudreuil-Soulanges',   '#43a047', 'vaudreuil-soulanges'],
      ['du Suroît',             '#ee2d62', 'du-suroit'],
      ['du Haut-Saint-Laurent', '#7c3aed', 'du-haut-saint-laurent']
    ],
    recrutement: null,
    app: false,
    banniere: null
  }
];

/* Description longue, invisible à l'œil (.sr-only) mais lue par Google et par les lecteurs
   d'écran. Une phrase par territoire, qui nomme ses RLS. */
function phraseRls(t) {
  const noms = t.rls.map(([n]) => n);
  const der = noms.pop();
  return noms.length ? noms.join(', ') + ' et ' + der : der;
}

/*
 * Blocs à SUPPRIMER de toute page régionale : tout ce qui est encadré, dans index.html, par
 *   <!-- hors-region:debut --> … <!-- hors-region:fin -->
 * C'est-à-dire les liens qui mènent à du contenu couvrant les trois territoires (le répertoire
 * /cliniques/, les guides PTEM/AMP) et les liens vers les cartes des autres territoires.
 * La suppression est faite ICI, à la fabrication du fichier, et non en JavaScript au chargement :
 * ces liens n'existent donc pas du tout dans le code source des pages dédiées — ni pour un
 * visiteur, ni pour Google, ni si le JavaScript ne s'exécute pas. C'est la différence entre
 * « masqué » et « absent », et c'est ce que demande l'engagement pris envers la Montérégie-Est.
 */
const BLOC_HORS_REGION = /[ \t]*<!-- hors-region:debut[\s\S]*?hors-region:fin -->[ \t]*\r?\n?/g;

/* Menu « i » d'une page régionale — contenu et ordre fixés par Olivier le 21 août pour l'Est,
 * repris tel quel pour les deux autres territoires :
 *   1. À propos du recrutement (URL du territoire quand elle existe, sinon celle de la
 *      Montérégie — le Centre et l'Ouest n'ont pas de page de recrutement distincte)
 *   2. les pages RLS du territoire
 *   3. les guides PTEM et AMP
 * Les 2 anciens liens PDF externes (« Besoins en établissement 2026 » et « Activités médicales
 * particulières ») sont RETIRÉS de ces pages : ce sont des documents 2025-2026 hors sujet ici.
 *
 * ISOLEMENT — toutes les destinations vivent DANS le dossier du territoire (chemins relatifs
 * SANS « ../ », donc à l'intérieur du dossier) : ce sont les copies isolées générées par
 * generer-pages-seo.js, qui ne contiennent aucun lien vers la carte générale, vers /cliniques/
 * ni vers un autre territoire. Rien dans ce menu ne fait sortir l'usager de son territoire. */
function menuRls(t) {
  return t.rls.map(([nom, couleur, slug]) =>
    '      <a class="info-menu-link" role="menuitem" href="rls/' + slug + '/">\n' +
    '        <span class="info-menu-ic" style="background:' + couleur + '">📋</span> Cliniques — RLS ' + nom + '\n' +
    '      </a>'
  ).join('\n');
}

function remplacements(t) {
  const r = [];
  const pousser = (ancien, nouveau) => r.push([ancien, nouveau]);

  // ── <head> : identité de la page ──
  pousser(
    '<title>PTEM 2027 Montérégie — Cliniques en recrutement | Trouve ta clinique</title>',
    `<title>Cliniques en recrutement — ${t.nom} | Trouve ta clinique</title>`
  );
  pousser(
    '<meta name="description" content="Explorez les cliniques en recrutement en Montérégie et comparez les milieux de pratique pour préparer votre PTEM en médecine familiale et vos AMP.">',
    `<meta name="description" content="Carte interactive des cliniques en recrutement en ${t.nom} : coordonnées, pratiques, horaires et personnes-ressources, pour préparer votre PTEM en médecine familiale.">`
  );
  pousser(
    '<link rel="canonical" href="https://trouvetaclinique.ca/">',
    `<link rel="canonical" href="https://trouvetaclinique.ca/${t.dossier}/">`
  );
  pousser(
    '<meta property="og:url" content="https://trouvetaclinique.ca/">',
    `<meta property="og:url" content="https://trouvetaclinique.ca/${t.dossier}/">`
  );
  pousser(
    '<meta property="og:title" content="PTEM 2027 Montérégie — Cliniques en recrutement | Trouve ta clinique">',
    `<meta property="og:title" content="Cliniques en recrutement — ${t.nom} | Trouve ta clinique">`
  );
  pousser(
    '<meta property="og:description" content="Carte interactive des cliniques en recrutement en Montérégie pour préparer son choix de milieu de pratique en médecine familiale.">',
    `<meta property="og:description" content="Carte interactive des cliniques en recrutement en ${t.nom} pour préparer son choix de milieu de pratique en médecine familiale.">`
  );
  pousser(
    '<meta name="twitter:title" content="PTEM 2027 Montérégie — Cliniques en recrutement | Trouve ta clinique">',
    `<meta name="twitter:title" content="Cliniques en recrutement — ${t.nom} | Trouve ta clinique">`
  );
  pousser(
    '<meta name="twitter:description" content="Carte interactive des cliniques en recrutement en Montérégie pour préparer son choix de milieu de pratique en médecine familiale.">',
    `<meta name="twitter:description" content="Carte interactive des cliniques en recrutement en ${t.nom} pour préparer son choix de milieu de pratique en médecine familiale.">`
  );
  pousser(
    '  "@id": "https://trouvetaclinique.ca/#website",\n  "name": "Trouve ta clinique — Cliniques en recrutement en Montérégie",\n  "alternateName": "PTEM 2027 — Cliniques en recrutement en Montérégie",\n  "url": "https://trouvetaclinique.ca/",\n  "inLanguage": "fr-CA",\n  "description": "Carte interactive des cliniques en recrutement médical de la Montérégie (Est, Centre et Ouest) : coordonnées, pratiques, horaires et personnes-ressources.",\n  "about": {\n    "@type": "Place",\n    "name": "Montérégie",',
    `  "@id": "https://trouvetaclinique.ca/${t.dossier}/#website",\n  "name": "Trouve ta clinique — ${t.nom}",\n  "alternateName": "Cliniques en recrutement — ${t.nom}",\n  "url": "https://trouvetaclinique.ca/${t.dossier}/",\n  "inLanguage": "fr-CA",\n  "description": "Carte interactive des cliniques en recrutement médical de la ${t.nom} : coordonnées, pratiques, horaires et personnes-ressources.",\n  "about": {\n    "@type": "Place",\n    "name": "${t.nom}",`
  );

  // Titre principal et description, invisibles à l'œil (.sr-only) mais lus par Google et par
  // les lecteurs d'écran. Sans ce remplacement, la page dédiée annoncerait littéralement
  // « sur les trois territoires : Montérégie-Est, Montérégie-Centre et Montérégie-Ouest ».
  pousser(
    '<h1 class="sr-only" id="page-h1">Trouve ta clinique — Cliniques en recrutement en Montérégie</h1>',
    `<h1 class="sr-only" id="page-h1">Trouve ta clinique — Cliniques en recrutement en ${t.nom}</h1>`
  );
  pousser(
    '  Carte interactive des cliniques et points de service qui recrutent des médecins de famille\n  en Montérégie, sur les trois territoires : Montérégie-Est, Montérégie-Centre et\n  Montérégie-Ouest. Pour chaque milieu : coordonnées, type de clinique, réseau local de\n  services, pratiques offertes, horaires et personne-ressource pour le recrutement.',
    `  Carte interactive des cliniques et points de service qui recrutent des médecins de famille\n  en ${t.nom}, dans les réseaux locaux de services ${phraseRls(t)}. Pour chaque milieu :\n  coordonnées, type de clinique, réseau local de services, pratiques offertes, horaires et\n  personne-ressource pour le recrutement.`
  );

  // ── Menu « i » ──
  // Premier lien : sur une page dédiée, il pointe vers la page de recrutement du territoire
  // quand elle existe (Est seulement à ce jour) ; sinon on garde celle de la Montérégie.
  if (t.recrutement) {
    pousser(
      '<a class="info-menu-link" role="menuitem" href="https://www.santemonteregie.qc.ca/recrutement-dtmf-monteregie" target="_blank" rel="noopener">\n        <span class="info-menu-ic">i</span> À propos du recrutement\n      </a>',
      `<a class="info-menu-link" role="menuitem" href="${t.recrutement}" target="_blank" rel="noopener">\n        <span class="info-menu-ic">i</span> À propos du recrutement\n      </a>`
    );
  }
  // Les 2 PDF externes cèdent la place aux pages RLS du territoire, puis aux guides.
  pousser(
    '      <hr>\n' +
    '      <a class="info-menu-link" role="menuitem" href="https://www.santemonteregie.qc.ca/sites/default/files/2025/06/besoins-etablissement_en-bref_2026v2_0.pdf" target="_blank" rel="noopener">\n' +
    '        <span class="info-menu-ic">⤓</span> Besoins en établissement 2026\n' +
    '      </a>\n' +
    '      <a class="info-menu-link" role="menuitem" href="https://www.santemonteregie.qc.ca/sites/default/files/2025/11/amp-2025_maj-octobre-2025.pdf" target="_blank" rel="noopener">\n' +
    '        <span class="info-menu-ic">⤓</span> Activités médicales particulières (AMP)\n' +
    '      </a>',
    '      <hr>\n' +
    menuRls(t) + '\n' +
    '      <hr>\n' +
    '      <a class="info-menu-link" role="menuitem" href="ptem/">\n' +
    '        <span class="info-menu-ic">📘</span> Guide PTEM 2027\n' +
    '      </a>\n' +
    '      <a class="info-menu-link" role="menuitem" href="amp/">\n' +
    '        <span class="info-menu-ic">📗</span> Guide des AMP\n' +
    '      </a>'
  );

  // ── Chemins des ressources ──
  // La page dédiée vit un dossier plus bas que index.html. On passe donc « ./x » à « ../x »
  // plutôt que d'écrire « /x » en absolu dans index.html — ce qui casserait le site s'il était
  // un jour servi depuis un sous-dossier (c'est le cas de l'ancienne adresse
  // dtmf-monteregie.github.io/Map/, encore encodée dans le code QR du comparatif PDF).
  pousser('<link rel="icon" type="image/png" sizes="32x32" href="./favicon-32.png">', '<link rel="icon" type="image/png" sizes="32x32" href="../favicon-32.png">');
  pousser('<link rel="icon" type="image/png" sizes="16x16" href="./favicon-16.png">', '<link rel="icon" type="image/png" sizes="16x16" href="../favicon-16.png">');
  pousser('<link rel="icon" type="image/png" sizes="48x48" href="./favicon-48.png">', '<link rel="icon" type="image/png" sizes="48x48" href="../favicon-48.png">');
  pousser('<link rel="stylesheet" href="./leaflet.css">', '<link rel="stylesheet" href="../leaflet.css">');
  pousser('<script src="./leaflet.js"></script>', '<script src="../leaflet.js"></script>');
  pousser("fetch('./data.json', { cache: 'no-cache' })", "fetch('../data.json', { cache: 'no-cache' })");
  // Le service worker reste celui de la racine (un seul, partagé) : « ../sw.js » depuis
  // /monteregie-<territoire>/ pointe sur /sw.js, dont la portée par défaut est « / ». Toutes les
  // pages partagent donc le même cache hors-ligne, sans doublon d'enregistrement.
  pousser("navigator.serviceWorker.register('./sw.js')", "navigator.serviceWorker.register('../sw.js')");

  // ── Installation (PWA) ──
  if (t.app) {
    // Montérégie-Est SEULEMENT. Depuis le 21 août, cette page utilise SON PROPRE manifeste
    // (manifest-est.webmanifest, à la racine à côté de manifest.json) et SES PROPRES icônes
    // (icon-est-*.png, apple-touch-icon-est.png — même logo bleu que la carte générale, depuis
    // le 22 août), pour s'installer comme une application distincte de la carte des trois
    // territoires. Voir manifest-est.webmanifest : id/start_url/scope = /monteregie-est/, ce qui
    // garantit à Android/Chrome que c'est une app séparée de celle dont le manifeste dit
    // /dtmf-monteregie/. short_name et apple-mobile-web-app-title restent "PTEM 2027" —
    // identiques à la carte générale (décision du 22 août) : aucun swap de texte ici.
    pousser('<link rel="manifest" href="./manifest.json">', '<link rel="manifest" href="../manifest-est.webmanifest">');
    pousser('<link rel="apple-touch-icon" href="./apple-touch-icon-180.png">', '<link rel="apple-touch-icon" href="../apple-touch-icon-est.png">');
    // Le navigateur installe TOUJOURS le manifeste lié à la page où on clique, donc jamais la
    // carte générale par erreur depuis /monteregie-est/. Seul le texte change ici.
    pousser(
      "<button class=\"btn-install\" id=\"btn-install\">⤓ <span class=\"btn-install-label\">Installer l'application</span></button>",
      '<button class="btn-install" id="btn-install">⤓ <span class="btn-install-label">Installer la carte Montérégie-Est</span></button>'
    );
    pousser(
      '<button type="button" class="info-menu-link" role="menuitem" id="info-menu-install">\n        <span class="info-menu-ic">⤓</span> Installer l\'application\n      </button>',
      '<button type="button" class="info-menu-link" role="menuitem" id="info-menu-install">\n        <span class="info-menu-ic">⤓</span> Installer la carte Montérégie-Est\n      </button>'
    );
  } else {
    // Centre et Ouest : ce sont des CARTES, pas des applications (décision d'Olivier,
    // 26 août 2026). Sans manifeste propre, laisser un bouton « Installer » installerait la
    // carte GÉNÉRALE des trois territoires — précisément le contraire de ce que cette page
    // promet. Les deux boutons sont donc retirés du code source, et le lien vers le manifeste
    // et l'icône d'accueil retombent sur ceux de la racine (chemin ajusté d'un dossier).
    pousser('<link rel="manifest" href="./manifest.json">', '<link rel="manifest" href="../manifest.json">');
    pousser('<link rel="apple-touch-icon" href="./apple-touch-icon-180.png">', '<link rel="apple-touch-icon" href="../apple-touch-icon-180.png">');
    pousser(
      "<button class=\"btn-install\" id=\"btn-install\">⤓ <span class=\"btn-install-label\">Installer l'application</span></button>",
      ''
    );
    pousser(
      '      <hr>\n      <button type="button" class="info-menu-link" role="menuitem" id="info-menu-install">\n        <span class="info-menu-ic">⤓</span> Installer l\'application\n      </button>\n',
      ''
    );
  }

  // ── Lettrage manuscrit du territoire ──
  // Kaushan Script n'est demandée QUE sur les pages régionales — la carte complète ne la
  // télécharge pas.
  pousser(
    '<link href="https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;600;700;800&family=Lato:wght@300;400;700&display=swap" rel="stylesheet">',
    '<link href="https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;600;700;800&family=Lato:wght@300;400;700&family=Kaushan+Script&display=swap" rel="stylesheet">'
  );
  // Les deux couleurs du lettrage + le trait sous « CLINIQUES EN RECRUTEMENT ». Écrites ICI, en
  // dur dans le HTML de la page dédiée, plutôt qu'appliquées en JavaScript au chargement :
  // l'écran de chargement s'affiche AVANT l'exécution des scripts, et le mot serait apparu en
  // retard, ou pire, dans la mauvaise couleur pendant une fraction de seconde.
  pousser(
    ':root { --mot-region: #ff3d96; --mot-halo: rgba(230,0,126,.8); }',
    `:root { --mot-region: ${t.couleur}; --mot-halo: ${t.halo}; }`
  );
  pousser(
    ':root { --sb-accent: linear-gradient(90deg, var(--logo-blue), var(--logo-teal), var(--logo-mint)); }',
    `:root { --sb-accent: ${t.accent}; }`
  );
  // Écran de chargement : le mot sous MONTÉRÉGIE (option « G7 » retenue le 20 août pour l'Est —
  // un essai d'agencement différent, testé le 21 août, a été écarté par Olivier au profit de
  // celui-ci).
  pousser(
    '      <span class="ldr-region">MONTÉRÉGIE</span>',
    `      <span class="ldr-region">MONTÉRÉGIE</span>\n      <span class="ldr-mot">${t.mot}</span>`
  );
  // En-tête : « Montérégie » suivi du mot manuscrit.
  pousser(
    '    <strong>Montérégie</strong>',
    `    <strong>Montérégie<span class="brand-tiret">-</span><span class="brand-mot">${t.mot}</span></strong>`
  );

  // ── Aperçu de partage ──
  // La bannière du territoire plutôt que celle de la carte générale (22 août, demande d'Olivier
  // — cohérence avec les copies régionales de /ptem/ et /amp/, voir copieEstPageStatique dans
  // generer-pages-seo.js). Les territoires sans bannière propre gardent celle de la Montérégie :
  // mieux vaut une image générique correcte qu'un lien mort vers une image inexistante.
  if (t.banniere) {
    pousser('<meta property="og:image" content="https://trouvetaclinique.ca/og-image.png?v=2">', `<meta property="og:image" content="${t.banniere.url}">`);
    pousser('<meta property="og:image:width" content="1200">', `<meta property="og:image:width" content="${t.banniere.largeur}">`);
    pousser('<meta property="og:image:height" content="630">', `<meta property="og:image:height" content="${t.banniere.hauteur}">`);
    pousser('<meta property="og:image:alt" content="Carte des cliniques en recrutement de la Montérégie — Trouve ta clinique.">', `<meta property="og:image:alt" content="${t.banniere.alt}">`);
    pousser('<meta name="twitter:image" content="https://trouvetaclinique.ca/og-image.png?v=2">', `<meta name="twitter:image" content="${t.banniere.url}">`);
  } else {
    pousser(
      '<meta property="og:image:alt" content="Carte des cliniques en recrutement de la Montérégie — Trouve ta clinique.">',
      `<meta property="og:image:alt" content="Carte interactive ${t.nom} — Trouve ta clinique.">`
    );
  }

  return r;
}

/*
 * Logo de l'écran de chargement (--app-pin) : le 21 août, le petit point avait été passé au
 * rose #ff3d96 sur la page Montérégie-Est. Olivier est revenu là-dessus le 22 août : « remettre
 * le logo original avec le point BLEU partout... je ne veux plus la variante avec le point
 * rose ». --app-pin n'est donc touché sur AUCUNE page régionale — toutes gardent exactement le
 * même logo (point bleu) que la carte générale, comme --app-logo l'a toujours fait.
 */

function publier(source, t) {
  let sortie = source.replace(BLOC_HORS_REGION, '');
  const manques = [];

  for (const [ancien, nouveau] of remplacements(t)) {
    if (!sortie.includes(ancien)) { manques.push(ancien.slice(0, 70)); continue; }
    sortie = sortie.replace(ancien, nouveau);
  }

  if (manques.length) {
    console.error(`publier-regions.js : ${manques.length} remplacement(s) introuvable(s) dans index.html pour ${t.nom} (le texte a changé ?) :`);
    manques.forEach(m => console.error('  - ' + m + '…'));
    process.exit(1);
  }

  /* Garde-fou d'ISOLEMENT — vérifié sur le fichier FINI, pas sur les intentions. Une page
     régionale ne doit contenir aucun lien vers la carte des trois territoires, vers le
     répertoire général, ni vers un autre territoire. C'est l'engagement pris envers la
     Montérégie-Est le 20 août, étendu aux trois pages : il est maintenant impossible de le
     rompre par accident en éditant index.html, puisque la publication échouerait ici. */
  // On teste des ATTRIBUTS href/src, pas des chaînes nues : index.html cite ces chemins dans
  // ses commentaires (« servi tel quel à /monteregie-est/, /monteregie-centre/… »), et un
  // commentaire n'emmène personne nulle part. Ne bloquer que ce qui est réellement cliquable.
  const interdits = [
    ['/cliniques/', 'lien vers le répertoire des trois territoires'],
    ['/ptem/',      'lien absolu vers le guide PTEM général'],
    ['/amp/',       'lien absolu vers le guide AMP général']
  ];
  for (const autre of TERRITOIRES) {
    if (autre.dossier === t.dossier) continue;
    interdits.push([`/${autre.dossier}/`, `lien vers la carte ${autre.nom}`]);
  }
  const lien = chemin => new RegExp('(?:href|src)\\s*=\\s*"[^"]*' +
    chemin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"');
  const fuites = interdits.filter(([motif]) => lien(motif).test(sortie));
  if (fuites.length) {
    console.error(`publier-regions.js : la page ${t.nom} contiendrait ${fuites.length} lien(s) hors territoire — publication annulée :`);
    fuites.forEach(([motif, quoi]) => console.error(`  - ${quoi}  (${motif})`));
    process.exit(1);
  }

  fs.mkdirSync(path.join(RACINE, t.dossier), { recursive: true });
  fs.writeFileSync(path.join(RACINE, t.dossier, 'index.html'), sortie, 'utf8');
  console.log(`  ${t.dossier}/index.html régénéré (${t.rls.length} RLS, ${t.app ? 'installable' : 'carte seule'}).`);
}

function main() {
  const source = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8');

  const blocs = source.match(BLOC_HORS_REGION);
  if (!blocs) {
    console.error('publier-regions.js : aucun bloc « hors-region » trouvé dans index.html. ' +
      'Les marqueurs ont-ils été renommés ou supprimés ? Publication annulée plutôt que de ' +
      'produire des pages régionales qui renverraient vers les autres territoires.');
    process.exit(1);
  }
  console.log(`  ${blocs.length} bloc(s) « hors-region » retiré(s) de chaque page.`);

  TERRITOIRES.forEach(t => publier(source, t));
  console.log(`${TERRITOIRES.length} pages régionales régénérées depuis index.html.`);
}

main();
