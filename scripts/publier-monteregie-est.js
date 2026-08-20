#!/usr/bin/env node
/*
 * Génère monteregie-est/index.html à partir de index.html : une copie du MÊME fichier (même
 * appli, même CSS, même data.json, même logique) — pas une deuxième page à maintenir à la main.
 *
 * Le comportement propre à la Montérégie-Est (ne charger que les cliniques de ce territoire,
 * masquer les pastilles de région, changer le sous-titre de l'en-tête, etc.) vit ENTIÈREMENT
 * dans index.html lui-même, au chargement, via la constante MODE_EST — voir le commentaire à
 * cet endroit dans index.html. Ce script-ci ne touche à rien de tout ça : il se contente
 * d'adapter les quelques balises <head> qui identifient la page pour les moteurs de recherche
 * et les aperçus de partage (titre, description, canonical, Open Graph, Twitter, JSON-LD),
 * puisque les robots qui lisent ces balises n'exécutent pas toujours le JavaScript de la page.
 *
 * Appelé automatiquement par .github/workflows/generer-pages-seo.yml à chaque modification de
 * index.html. Se lance aussi à la main pour tester en local : node scripts/publier-monteregie-est.js
 *
 * Si un des textes ci-dessous ne se retrouve plus tel quel dans index.html (parce que le titre,
 * la description ou le JSON-LD ont été modifiés depuis), le script s'arrête en erreur plutôt que
 * de publier une copie Montérégie-Est avec un texte générique erroné — mieux vaut une
 * régénération qui échoue bruyamment qu'une page publiée avec la mauvaise information.
 */
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');

const REMPLACEMENTS = [
  [
    '<title>PTEM 2027 Montérégie — Cliniques en recrutement | Trouve ta clinique</title>',
    '<title>Cliniques en recrutement — Montérégie-Est | Trouve ta clinique</title>'
  ],
  [
    '<meta name="description" content="Explorez les cliniques en recrutement en Montérégie et comparez les milieux de pratique pour préparer votre PTEM en médecine familiale et vos AMP.">',
    '<meta name="description" content="Carte interactive des cliniques en recrutement en Montérégie-Est : coordonnées, pratiques, horaires et personnes-ressources, pour préparer votre PTEM en médecine familiale.">'
  ],
  [
    '<link rel="canonical" href="https://trouvetaclinique.ca/">',
    '<link rel="canonical" href="https://trouvetaclinique.ca/monteregie-est/">'
  ],
  [
    '<meta property="og:url" content="https://trouvetaclinique.ca/">',
    '<meta property="og:url" content="https://trouvetaclinique.ca/monteregie-est/">'
  ],
  [
    '<meta property="og:title" content="PTEM 2027 Montérégie — Cliniques en recrutement | Trouve ta clinique">',
    '<meta property="og:title" content="Cliniques en recrutement — Montérégie-Est | Trouve ta clinique">'
  ],
  [
    '<meta property="og:description" content="Carte interactive des cliniques en recrutement en Montérégie pour préparer son choix de milieu de pratique en médecine familiale.">',
    '<meta property="og:description" content="Carte interactive des cliniques en recrutement en Montérégie-Est pour préparer son choix de milieu de pratique en médecine familiale.">'
  ],
  [
    '<meta name="twitter:title" content="PTEM 2027 Montérégie — Cliniques en recrutement | Trouve ta clinique">',
    '<meta name="twitter:title" content="Cliniques en recrutement — Montérégie-Est | Trouve ta clinique">'
  ],
  [
    '<meta name="twitter:description" content="Carte interactive des cliniques en recrutement en Montérégie pour préparer son choix de milieu de pratique en médecine familiale.">',
    '<meta name="twitter:description" content="Carte interactive des cliniques en recrutement en Montérégie-Est pour préparer son choix de milieu de pratique en médecine familiale.">'
  ],
  [
    '  "@id": "https://trouvetaclinique.ca/#website",\n  "name": "Trouve ta clinique — Cliniques en recrutement en Montérégie",\n  "alternateName": "PTEM 2027 — Cliniques en recrutement en Montérégie",\n  "url": "https://trouvetaclinique.ca/",\n  "inLanguage": "fr-CA",\n  "description": "Carte interactive des cliniques en recrutement médical de la Montérégie (Est, Centre et Ouest) : coordonnées, pratiques, horaires et personnes-ressources.",\n  "about": {\n    "@type": "Place",\n    "name": "Montérégie",',
    '  "@id": "https://trouvetaclinique.ca/monteregie-est/#website",\n  "name": "Trouve ta clinique — Montérégie-Est",\n  "alternateName": "Cliniques en recrutement — Montérégie-Est",\n  "url": "https://trouvetaclinique.ca/monteregie-est/",\n  "inLanguage": "fr-CA",\n  "description": "Carte interactive des cliniques en recrutement médical de la Montérégie-Est : coordonnées, pratiques, horaires et personnes-ressources.",\n  "about": {\n    "@type": "Place",\n    "name": "Montérégie-Est",'
  ],
  // Titre principal et description, invisibles à l'œil (.sr-only) mais lus par Google et par
  // les lecteurs d'écran. Sans ce remplacement, la page dédiée annoncerait littéralement
  // « sur les trois territoires : Montérégie-Est, Montérégie-Centre et Montérégie-Ouest ».
  [
    '<h1 class="sr-only" id="page-h1">Trouve ta clinique — Cliniques en recrutement en Montérégie</h1>',
    '<h1 class="sr-only" id="page-h1">Trouve ta clinique — Cliniques en recrutement en Montérégie-Est</h1>'
  ],
  [
    '  Carte interactive des cliniques et points de service qui recrutent des médecins de famille\n  en Montérégie, sur les trois territoires : Montérégie-Est, Montérégie-Centre et\n  Montérégie-Ouest. Pour chaque milieu : coordonnées, type de clinique, réseau local de\n  services, pratiques offertes, horaires et personne-ressource pour le recrutement.',
    '  Carte interactive des cliniques et points de service qui recrutent des médecins de famille\n  en Montérégie-Est, dans les réseaux locaux de services Pierre-Boucher, Pierre-De Saurel et\n  Richelieu-Yamaska. Pour chaque milieu : coordonnées, type de clinique, réseau local de\n  services, pratiques offertes, horaires et personne-ressource pour le recrutement.'
  ],
  // Chemins des ressources : la page dédiée vit un dossier plus bas que index.html. On passe
  // donc « ./x » à « ../x » plutôt que d'écrire « /x » en absolu dans index.html — ce qui
  // casserait le site s'il était un jour servi depuis un sous-dossier (c'est le cas de
  // l'ancienne adresse dtmf-monteregie.github.io/Map/, encore encodée dans le code QR du
  // comparatif PDF).
  ['<link rel="manifest" href="./manifest.json">', '<link rel="manifest" href="../manifest.json">'],
  ['<link rel="icon" type="image/png" sizes="32x32" href="./favicon-32.png">', '<link rel="icon" type="image/png" sizes="32x32" href="../favicon-32.png">'],
  ['<link rel="icon" type="image/png" sizes="16x16" href="./favicon-16.png">', '<link rel="icon" type="image/png" sizes="16x16" href="../favicon-16.png">'],
  ['<link rel="icon" type="image/png" sizes="48x48" href="./favicon-48.png">', '<link rel="icon" type="image/png" sizes="48x48" href="../favicon-48.png">'],
  ['<link rel="apple-touch-icon" href="./apple-touch-icon-180.png">', '<link rel="apple-touch-icon" href="../apple-touch-icon-180.png">'],
  ['<link rel="stylesheet" href="./leaflet.css">', '<link rel="stylesheet" href="../leaflet.css">'],
  ['<script src="./leaflet.js"></script>', '<script src="../leaflet.js"></script>'],
  ["fetch('./data.json', { cache: 'no-cache' })", "fetch('../data.json', { cache: 'no-cache' })"],
  // Le service worker reste celui de la racine (un seul, partagé) : « ../sw.js » depuis
  // /monteregie-est/ pointe sur /sw.js, dont la portée par défaut est « / ». Les deux pages
  // partagent donc le même cache hors-ligne, sans doublon d'enregistrement.
  ["navigator.serviceWorker.register('./sw.js')", "navigator.serviceWorker.register('../sw.js')"],

  /* ----------------------------------------------------------------------------------------
   * Lettrage « est » manuscrit (Kaushan Script, dégradé blanc → rose). Il est écrit ICI, en
   * dur dans le HTML de la page dédiée, plutôt qu'ajouté en JavaScript au chargement : l'écran
   * de chargement s'affiche avant l'exécution des scripts, et le mot serait apparu en retard.
   * Kaushan Script n'est demandée QUE sur cette page — la carte complète ne la télécharge pas.
   * -------------------------------------------------------------------------------------- */
  [
    '<link href="https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;600;700;800&family=Lato:wght@300;400;700&display=swap" rel="stylesheet">',
    '<link href="https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;600;700;800&family=Lato:wght@300;400;700&family=Kaushan+Script&display=swap" rel="stylesheet">'
  ],
  // Écran de chargement : « est » sous MONTÉRÉGIE.
  [
    '      <span class="ldr-region">MONTÉRÉGIE</span>',
    '      <span class="ldr-region">MONTÉRÉGIE</span>\n      <span class="ldr-est">est</span>'
  ],
  // En-tête : remplace le « Montérégie » (que l\'ancienne version complétait en « Montérégie-Est »
  // par JavaScript) par « Montérégie » suivi du « est » manuscrit.
  [
    '    <strong>Montérégie</strong>',
    '    <strong>Montérégie<span class="brand-tiret">-</span><span class="brand-est">est</span></strong>'
  ]
];

/*
 * Blocs à SUPPRIMER de la page Montérégie-Est : tout ce qui est encadré, dans index.html, par
 *   <!-- hors-est:debut --> … <!-- hors-est:fin -->
 * C'est-à-dire les liens qui mènent à du contenu couvrant les trois territoires (le répertoire
 * /cliniques/, et le lien vers la carte Est lui-même qui n'a pas de sens sur la carte Est).
 * La suppression est faite ICI, à la fabrication du fichier, et non en JavaScript au chargement :
 * ces liens n'existent donc pas du tout dans le code source de la page dédiée — ni pour un
 * visiteur, ni pour Google, ni si le JavaScript ne s'exécute pas. C'est la différence entre
 * « masqué » et « absent », et c'est ce que demande l'engagement pris envers la Montérégie-Est.
 */
const BLOC_HORS_EST = /[ \t]*<!-- hors-est:debut[\s\S]*?hors-est:fin -->[ \t]*\r?\n?/g;

function main() {
  const source = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8');
  let sortie = source;
  const manques = [];

  const blocs = source.match(BLOC_HORS_EST);
  if (!blocs) {
    console.error('publier-monteregie-est.js : aucun bloc « hors-est » trouvé dans index.html. ' +
      'Les marqueurs ont-ils été renommés ou supprimés ? Publication annulée plutôt que de ' +
      'produire une page Montérégie-Est qui renverrait vers les autres territoires.');
    process.exit(1);
  }
  console.log(`  ${blocs.length} bloc(s) « hors-est » retiré(s).`);
  sortie = sortie.replace(BLOC_HORS_EST, '');

  for (const [ancien, nouveau] of REMPLACEMENTS) {
    if (!sortie.includes(ancien)) { manques.push(ancien.slice(0, 70)); continue; }
    sortie = sortie.replace(ancien, nouveau);
  }

  if (manques.length) {
    console.error(`publier-monteregie-est.js : ${manques.length} remplacement(s) introuvable(s) dans index.html (le texte a changé ?) :`);
    manques.forEach(m => console.error('  - ' + m + '…'));
    process.exit(1);
  }

  fs.mkdirSync(path.join(RACINE, 'monteregie-est'), { recursive: true });
  fs.writeFileSync(path.join(RACINE, 'monteregie-est', 'index.html'), sortie, 'utf8');
  console.log('monteregie-est/index.html régénéré depuis index.html.');
}

main();
