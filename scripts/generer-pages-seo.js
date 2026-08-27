#!/usr/bin/env node
/*
 * GÉNÉRATEUR DE PAGES SEO — Trouve ta clinique (trouvetaclinique.ca)
 * =================================================================
 * Créé le 19 août 2026. Ne dépend d'AUCUNE bibliothèque externe : `node scripts/generer-pages-seo.js`
 * à la racine du dépôt suffit.
 *
 * CE QU'IL FAIT
 *   data.json  ──►  cliniques/index.html              (répertoire, hub)
 *                   cliniques/<slug>/index.html       (une page par clinique publiée)
 *                   rls/<slug>/index.html             (une page par RLS ayant des cliniques)
 *                   monteregie-est/rls/index.html     (hub des 3 RLS de l'univers Est, 22 août)
 *                   sitemap.xml                       (toutes les URL du site)
 *
 * POURQUOI
 *   Avant, la liste des cliniques existait en 3 exemplaires tenus à la main (data.json, le bloc
 *   caché de l'accueil, la page /cliniques/). Chaque modification devait être répétée partout et
 *   les copies dérivaient. Désormais data.json est l'UNIQUE source de vérité : on modifie
 *   data.json, on relance ce script, tout le reste se reconstruit.
 *
 * RÈGLES DE SÉCURITÉ DES DONNÉES (à ne pas assouplir sans y réfléchir)
 *   1. LISTE BLANCHE. Seuls les champs listés dans CHAMPS_PUBLICS ci-dessous sortent dans le HTML.
 *      Un nouveau champ ajouté à data.json n'apparaîtra JAMAIS tout seul sur le site public : il
 *      faut l'ajouter ici volontairement. C'est l'inverse d'une liste noire, qui laisserait fuir
 *      tout champ oublié.
 *   2. "notes" NE SORT JAMAIS. C'est le champ réservé aux notes personnelles des usagers.
 *   3. Les fiches "visible: false" sont ignorées partout (page, répertoire, sitemap).
 *   4. Les courriels de recrutement ne sont PAS publiés (voir PUBLIER_COURRIELS).
 *   5. On ne copie jamais le HTML de la fiche de l'application (#dp-body / exportFiche) : cette
 *      fiche contient des éléments propres à l'app (notes, boutons). Les pages ci-dessous sont
 *      construites à partir des DONNÉES, pas de l'affichage.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const SITE = 'https://trouvetaclinique.ca';

/*
 * Cloudflare Web Analytics — injecté une seule fois par page, juste avant </body>, via le
 * template commun page() ci-dessous. Ajouté le 20 août 2026 à la demande d'Olivier. Ce script
 * est un <script type="module"> chargé de façon asynchrone par le navigateur : il ne bloque
 * pas le rendu et ne touche à rien d'autre sur la page (pas de cookie, pas de tierce donnée
 * personnelle — mesure de fréquentation agrégée seulement, cf. Cloudflare).
 */
const CLOUDFLARE_ANALYTICS = `<!-- Cloudflare Web Analytics -->
<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"ceb6d077f71c46ffa566fe67de3eb336"}'></script>
<!-- End Cloudflare Web Analytics -->`;

/*
 * Badge « Vérifié » — bascule l'infobulle au toucher/clic. Le survol et le focus clavier sont
 * déjà gérés en CSS pure (voir assets/seo-pages.css) ; seul le toucher a besoin de JS, un simple
 * :focus ne se déclenchant pas de façon fiable au tap sur mobile. Ajouté le 26 août 2026, aucune
 * dépendance externe. N'apparaît dans la page que si elle contient au moins un badge (voir
 * l'usage de cette constante dans page() plus bas).
 */
const BADGE_VERIF_SCRIPT = `<script>
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('.badge-verif');document.querySelectorAll('.badge-verif.show').forEach(function(x){if(x!==b)x.classList.remove('show')});if(b){e.stopPropagation();b.classList.toggle('show')}});
document.addEventListener('keydown',function(e){if(e.key==='Escape')document.querySelectorAll('.badge-verif.show').forEach(function(b){b.classList.remove('show')})});
</script>`;

/* ------------------------------------------------------------------------------------------- */
/* RÉGLAGES                                                                                     */
/* ------------------------------------------------------------------------------------------- */

/*
 * Publier ou non les courriels de recrutement sur les pages indexables.
 * Choix d'Olivier le 19 août 2026 : NON. Sur 26 fiches renseignées, 24 portent une adresse
 * NOMINATIVE (prenom.nom.med@ssss.gouv.qc.ca) — c'est-à-dire l'adresse professionnelle d'une
 * personne identifiable. Les publier sur 61 pages indexables revient à les livrer aux robots de
 * collecte d'adresses. Les coordonnées restent disponibles dans l'application (carte + fiche),
 * ce qui suffit largement à quelqu'un qui veut réellement postuler.
 * Mettre à true pour changer d'avis : rien d'autre à modifier.
 */
const PUBLIER_COURRIELS = false;

/*
 * Seuil de contenu à partir duquel une page de clinique est jugée assez substantielle pour être
 * proposée à l'indexation. En dessous, la page existe quand même (elle sert au visiteur) mais
 * porte "noindex" et reste hors du sitemap.
 *
 * Pourquoi : au 19 août 2026, 23 fiches sur 61 n'ont que 2 à 4 champs remplis (pas d'horaire, pas
 * d'équipe). 23 pages quasi vides publiées d'un coup, c'est le motif que Google appelle « contenu
 * mince produit à grande échelle » — le risque n'est pas seulement que ces pages ne classent pas,
 * c'est qu'elles tirent le domaine entier vers le bas.
 *
 * Ce seuil est AUTOMATIQUE : dès qu'une fiche se remplit dans data.json et repasse au-dessus, la
 * prochaine génération la bascule en indexable toute seule. Rien à surveiller à la main.
 */
const SEUIL_INDEXATION = 5;

/* Champs comptés pour évaluer la substance d'une fiche (voir SEUIL_INDEXATION). */
const CHAMPS_SUBSTANCE = [
  'adresse', 'horaire', 'personnel', 'dme', 'pratiques', 'niveau',
  'frais', 'bureau', 'site', 'presentation', 'infos', 'gardeUrgence', 'gardeAutre'
];

/*
 * LISTE BLANCHE des champs de data.json autorisés à sortir sur le site public.
 * Tout ce qui n'est pas ici n'est jamais rendu. Volontairement absents :
 *   notes            → notes personnelles des usagers, ne doivent jamais fuir
 *   personneRessource→ courriels de recrutement (voir PUBLIER_COURRIELS)
 *   alias            → mots-clés de recherche interne, pas du contenu
 *   lat / lng        → utiles à la carte, inutiles au lecteur ; restent dans data.json
 *   posApprox        → indicateur technique de précision du géocodage
 *   visible          → drapeau de publication, pas du contenu
 *   recrutementActif → drapeau de statut (même nature que « visible »), voir recrute() plus
 *                      bas ; sert à choisir entre deux textes tout faits, jamais affiché tel quel
 *   statutRecrutement→ texte libre du brouillon d'origine, non repris ; recrute() + un texte fixe
 *                      (« Ne recrute pas actuellement ») suffisent et restent cohérents avec
 *                      l'application (voir index.html)
 */
const CHAMPS_PUBLICS = [
  'id', 'nom', 'ville', 'adresse', 'type', 'region', 'rls', 'niveau', 'niveaux',
  'dme', 'pratiques', 'bureau', 'frais', 'horaire', 'personnel', 'site',
  'porteOuverte', 'presentation', 'infos', 'gardeUrgence', 'gardeAutre',
  /* validation → ajouté le 26 août 2026. N'est PAS affiché comme ligne de fiche ; sert
     uniquement à décider si le badge « Vérifié » apparaît et à afficher sa date (voir
     estValide()/badgeVerif() plus bas). Le sous-champ "source" n'est jamais publié. */
  'validation'
];

/*
 * Un milieu « ne recrute pas actuellement » (recrutementActif === false, 27 août 2026 — 43
 * fiches importées du brouillon Montérégie-Est d'Olivier) reste publié : sa page, sa présence
 * dans le répertoire et dans sa page de RLS suivent exactement les mêmes règles qu'un milieu en
 * recrutement (seuil de substance, liste blanche, etc.). Seul le TEXTE change à quelques
 * endroits précis, pour ne jamais affirmer qu'un milieu recrute quand ce n'est pas le cas — voir
 * chaque usage de recrute() ci-dessous.
 */
function recrute(c) { return c.recrutementActif !== false; }

/* Libellés lisibles des codes de pratique (mêmes libellés que la légende de la carte). */
const PRATIQUES = {
  pec:  'Prise en charge',
  gap:  "Guichet d'accès à la première ligne",
  sad:  'Soins à domicile',
  peri: 'Périnatalité',
  msk:  'Médecine sportive',
  chir: 'Chirurgie mineure'
};

/* Libellés lisibles des catégories de personnel. */
const PERSONNEL = {
  medecins: 'Médecins',
  residents: 'Résidents',
  ipspl: 'IPSPL',
  infirmieres: 'Infirmières',
  infauxiliaires: 'Infirmières auxiliaires',
  pharmaciennes: 'Pharmaciennes',
  nutritionnistes: 'Nutritionnistes',
  physiotherapeutes: 'Physiothérapeutes',
  psychologues: 'Psychologues',
  travailleuresSociales: 'Travailleuses sociales',
  intervenantspsychosociaux: 'Intervenants psychosociaux',
  specialistes: 'Spécialistes'
};

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const JOURS_SCHEMA = {
  Lundi: 'Monday', Mardi: 'Tuesday', Mercredi: 'Wednesday', Jeudi: 'Thursday',
  Vendredi: 'Friday', Samedi: 'Saturday', Dimanche: 'Sunday'
};

/* ------------------------------------------------------------------------------------------- */
/* OUTILS                                                                                       */
/* ------------------------------------------------------------------------------------------- */

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function rempli(v) {
  if (v == null) return false;
  if (typeof v === 'string') {
    const t = v.trim();
    return t !== '' && !['à compléter', 'a completer', 'tbd', 'n/a'].includes(t.toLowerCase());
  }
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.values(v).some(rempli);
  return true;
}

/*
 * Badge « Vérifié » — voir aussi index.html (.badge-verif / estValide / badgeVerifHtml, ajoutés
 * le 26 août 2026 pour l'application). Même logique côté pages statiques : le badge n'apparaît
 * QUE si validation.statut === 'valide' (révision manuelle terminée), jamais sur une simple
 * réponse reçue au formulaire. Champ ajouté volontairement à CHAMPS_PUBLICS ci-dessus — voir la
 * liste blanche — mais UNIQUEMENT pour décider d'afficher ce badge et sa date ; le contenu brut
 * de "validation" n'est jamais affiché comme ligne de la fiche (pas de source/statut visibles).
 */
const MOIS_FR_SEO = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
function dateLisibleFr(iso) {
  const m = typeof iso === 'string' && iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const mois = MOIS_FR_SEO[parseInt(m[2], 10) - 1];
  return mois ? `${parseInt(m[3], 10)} ${mois} ${m[1]}` : '';
}
function estValide(c) { return !!(c && c.validation && c.validation.statut === 'valide'); }
const SVG_BADGE_VERIF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/></svg>';
function badgeVerif(c) {
  if (!estValide(c)) return '';
  const date = dateLisibleFr(c.validation.date);
  const msg = 'Informations confirmées par la clinique via le formulaire.'
    + (date ? ' Dernière validation : ' + date + '.' : '');
  return `<button type="button" class="badge-verif" title="${esc(msg)}" aria-label="${esc(msg)}"><span class="badge-verif-tip" aria-hidden="true">${esc(msg)}</span>${SVG_BADGE_VERIF}</button>`;
}

/* Slug lisible et stable : minuscules, sans accent, tirets. Le contenu entre parenthèses est
   CONSERVÉ — c'est parfois la seule chose qui distingue deux fiches (« GMF Saint-Constant
   (Monchamp) » et « GMF Saint-Constant (de la gare) »). */
function slugifier(nom) {
  return String(nom)
    /* Les ligatures "oe"/"ae" (27 aout 2026) ne sont pas des lettres accentuees : NFD ne les
       decompose pas, elles survivraient donc telles quelles jusqu'au filtre [^a-z0-9] suivant et
       tomberaient comme un tiret ("Coeur" -> "c-ur"). Repris de la meme normalisation que
       normTxt() dans index.html (recherche), pour que "coeur" reste lisible dans l'URL plutot
       qu'un tiret au milieu du mot. */
    .replace(/\u0153/g, 'oe').replace(/\u0152/g, 'Oe').replace(/\u00e6/g, 'ae').replace(/\u00c6/g, 'Ae')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 80).replace(/-+$/, '');
}

/*
 * Slugs STABLES. Une URL déjà indexée par Google ne doit pas changer parce qu'on a corrigé une
 * faute dans le nom d'une clinique. On garde donc une correspondance id → slug dans
 * scripts/slugs.json : une fois qu'un identifiant a reçu son slug, il le garde pour toujours.
 * Seules les fiches nouvelles reçoivent un slug calculé.
 */
function chargerSlugs(fichier) {
  try { return JSON.parse(fs.readFileSync(fichier, 'utf8')); }
  catch (e) { return {}; }
}

function attribuerSlugs(cliniques, memoire) {
  const pris = new Set(Object.values(memoire));
  const nouveaux = [];
  for (const c of cliniques) {
    const cle = String(c.id);
    if (memoire[cle]) continue;             // déjà attribué : on n'y touche jamais
    let base = slugifier(c.nom) || ('clinique-' + cle);
    let slug = base, n = 2;
    while (pris.has(slug)) { slug = base + '-' + n; n++; }
    memoire[cle] = slug;
    pris.add(slug);
    nouveaux.push({ id: cle, nom: c.nom, slug });
  }
  return nouveaux;
}

/* Découpe l'adresse pour schema.org sans jamais inventer. Le code postal n'est extrait que s'il
   correspond exactement au format canadien ; la ville vient du champ « ville », pas d'une
   supposition sur la chaîne. Si on ne sait pas découper, on omet le morceau. */
function decouperAdresse(adresse, ville) {
  const out = { addressLocality: ville || undefined, addressRegion: 'QC', addressCountry: 'CA' };
  if (!rempli(adresse)) return out;
  let reste = String(adresse).trim();
  const cp = reste.match(/\b([A-Z]\d[A-Z]\s?\d[A-Z]\d)\b/);
  if (cp) { out.postalCode = cp[1]; reste = reste.replace(cp[0], ''); }
  reste = reste.replace(/\bQC\b|\bQu[ée]bec\b/gi, '');
  if (ville) reste = reste.replace(new RegExp('\\b' + ville.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi'), '');
  reste = reste.replace(/[,\s]+$/g, '').replace(/^[,\s]+/g, '').replace(/\s{2,}/g, ' ').replace(/,\s*,/g, ',');
  if (reste) out.streetAddress = reste;
  return out;
}

/* « 8h00 – 20h00 » → { opens:'08:00', closes:'20:00' }. Gère les journées coupées
   (« 8h30 – 11h45 / 13h00 – 16h30 » → deux plages). Tout ce qui n'est pas une plage horaire
   claire (« Fermé », « Urgence sur RDV seulement ») ne produit RIEN plutôt qu'une approximation. */
function analyserPlages(texte) {
  const plages = [];
  for (const morceau of String(texte).split('/')) {
    const m = morceau.match(/(\d{1,2})\s*h\s*(\d{2})?\s*[–\-—]\s*(\d{1,2})\s*h\s*(\d{2})?/);
    if (!m) continue;
    const p = (h, min) => String(h).padStart(2, '0') + ':' + (min || '00');
    plages.push({ opens: p(m[1], m[2]), closes: p(m[3], m[4]) });
  }
  return plages;
}

/* ------------------------------------------------------------------------------------------- */
/* GABARIT COMMUN                                                                               */
/* ------------------------------------------------------------------------------------------- */

/* ------------------------------------------------------------------------------------------- */
/* LES DEUX UNIVERS DU SITE                                                                     */
/* ------------------------------------------------------------------------------------------- */

/*
 * Depuis le 21 août 2026, le générateur produit DEUX jeux de pages à partir des mêmes données :
 *
 *   UNIVERS_GENERAL  — /cliniques/…, /rls/… : le site tel qu'il existait, les trois territoires.
 *   UNIVERS_REGIONS  — /monteregie-est/…,
 *                      /monteregie-centre/…,
 *                      /monteregie-ouest/…    : un univers COMPLÈTEMENT ÉTANCHE par territoire.
 *                                               Né pour la seule Montérégie-Est le 21 août 2026,
 *                                               étendu aux trois territoires le 26 août.
 *
 * Pourquoi un univers séparé plutôt qu'un simple filtre : demande d'Olivier du 21 août, en
 * réponse au besoin exprimé par le CISSS Montérégie-Est. Une personne qui entre par
 * /monteregie-est/ ne doit JAMAIS croiser un lien vers la carte des trois territoires, vers le
 * répertoire /cliniques/ (qui mélange les territoires) ni vers un RLS d'un autre CISSS — ni dans
 * l'en-tête, ni dans le fil d'Ariane, ni dans un bouton, ni dans « pour aller plus loin ». Les
 * pages de l'univers Est n'ont donc pas les mêmes liens : c'est la seule différence entre les
 * deux versions d'une même fiche, le contenu lui-même est identique.
 *
 * Le prix à payer, c'est du contenu quasi identique à deux adresses. Il est réglé plus bas par
 * les règles d'indexation (voir seoDe()) : pour un contenu propre à l'Est, c'est la page
 * /monteregie-est/ qui est l'officielle et la page générale qui s'efface; jamais les deux.
 */
const UNIVERS_GENERAL = {
  regional: false,
  region: null,
  nom: 'Montérégie',
  prefixe: '',
  accueil: '/',
  dossier: '',
  marque: 'Trouve ta clinique',
  canonique: true,
  banniere: null
};

/*
 * CANONIQUE — laquelle des deux adresses d'un même contenu est l'officielle pour Google.
 *
 * Montérégie-Est : c'est la page RÉGIONALE (décision d'Olivier du 21 août 2026, voir plus bas
 * dans pageClinique). La page générale reste en ligne mais s'efface au profit d'elle.
 *
 * Centre et Ouest : c'est la page GÉNÉRALE qui reste l'officielle. Leurs pages régionales,
 * ouvertes le 26 août 2026, existent pour la navigation et l'étanchéité du territoire — pas
 * pour prendre la place des pages générales dans l'index. Basculer les trois territoires d'un
 * coup aurait mis EN NOINDEX la totalité de /cliniques/ et de /rls/, c'est-à-dire tout ce que
 * le site a déjà acquis en référencement ; ce n'est pas ce qui a été demandé, et ça se décide
 * séparément. Pour l'inverser un jour, il suffit de passer `canonique` à true ci-dessous :
 * l'indexation, les canoniques et le sitemap suivent tout seuls.
 */
/* ordreRls — l'ordre dans lequel les RLS d'un territoire sont présentés sur son hub /rls/.
   C'est EXACTEMENT celui de RLS_COLORS_PAR_REGION dans index.html, donc celui de la légende de
   la carte : la carte, la liste latérale et cette page racontent la même histoire dans le même
   ordre. Un RLS absent de cette liste (nouveau territoire, renommage) passerait à la fin plutôt
   que de disparaître — voir rangRls(). */
const UNIVERS_REGIONS = [
  { region: 'Est',    nom: 'Montérégie-Est',    dossier: 'monteregie-est',    canonique: true,
    ordreRls: ['Pierre-Boucher', 'Richelieu-Yamaska', 'Pierre-De Saurel'],
    banniere: { fichier: 'banniere_monteregie-est.png', largeur: '1600', hauteur: '400' } },
  { region: 'Centre', nom: 'Montérégie-Centre', dossier: 'monteregie-centre', canonique: false,
    ordreRls: ['Champlain', 'Haut-Richelieu–Rouville'],
    banniere: null },
  { region: 'Ouest',  nom: 'Montérégie-Ouest',  dossier: 'monteregie-ouest',  canonique: false,
    ordreRls: ['Jardins-Roussillon', 'Vaudreuil-Soulanges', 'du Suroît', 'du Haut-Saint-Laurent'],
    banniere: null }
].map(u => Object.assign({
  regional: true,
  prefixe: '/' + u.dossier,
  accueil: '/' + u.dossier + '/',
  marque: 'Trouve ta clinique — ' + u.nom
}, u));

/* Accès par territoire : UNIVERS_PAR_REGION['Est'] → l'univers de la Montérégie-Est. */
const UNIVERS_PAR_REGION = Object.fromEntries(UNIVERS_REGIONS.map(u => [u.region, u]));

function page({ titre, description, url, profondeur, indexable = true, canonical, jsonLd,
                filDAriane, corps, actif, univers = UNIVERS_GENERAL }) {
  const u = univers;
  /* Feuille de style : chemin relatif dans l'univers général (comme avant), absolu dans
     l'univers Est, dont les pages ne vivent pas toutes à la même profondeur. */
  const cssHref = u.regional ? '/assets/seo-pages.css'
                        : (profondeur === 1 ? '../' : '../../') + 'assets/seo-pages.css';
  const robots = indexable
    ? 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'
    : 'noindex,follow';
  // Aperçu de partage (og:image) : la bannière Montérégie-Est dans l'univers Est, pour qu'un
  // lien partagé (courriel à Nancy, réseaux sociaux…) affiche la bonne image — pas celle de la
  // carte générale des 3 territoires (22 août, demande d'Olivier : « bannière officielle... de
  // façon cohérente partout »).
  const ogImage = u.banniere ? `${SITE}/assets/${u.banniere.fichier}` : `${SITE}/og-image.png?v=2`;
  const ogImageW = u.banniere ? u.banniere.largeur : '1200';
  const ogImageH = u.banniere ? u.banniere.hauteur : '630';
  const ogImageAlt = u.regional
    ? `Carte interactive ${u.nom} — Trouve ta clinique.`
    : 'Carte des cliniques en recrutement de la Montérégie — Trouve ta clinique.';
  /* Pas d'entrée « Cliniques » dans un univers régional : ce répertoire regroupe les cliniques
     des TROIS territoires. Les cliniques d'un territoire se rejoignent par leur page de RLS. */
  const liens = u.regional
    ? [[u.accueil, 'Carte ' + u.nom, 'carte'],
       [u.prefixe + '/ptem/', 'PTEM', 'ptem'],
       [u.prefixe + '/amp/', 'AMP', 'amp']]
    : [['/', 'Carte des cliniques', 'carte'],
       ['/ptem/', 'PTEM', 'ptem'],
       ['/amp/', 'AMP', 'amp'],
       ['/cliniques/', 'Cliniques', 'cliniques']];
  const nav = liens.map(([href, txt, cle]) =>
    `      <a href="${href}"${actif === cle ? ' aria-current="page"' : ''}>${txt}</a>`).join('\n');

  return `<!doctype html>
<html lang="fr-CA">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(titre)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${esc(canonical || url)}">
  <meta name="robots" content="${robots}">
  <meta property="og:locale" content="fr_CA">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Trouve ta clinique">
  <meta property="og:title" content="${esc(titre)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(url)}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:image:width" content="${ogImageW}">
  <meta property="og:image:height" content="${ogImageH}">
  <meta property="og:image:alt" content="${esc(ogImageAlt)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(titre)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${ogImage}">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">
  <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png">
  <link rel="apple-touch-icon" href="/apple-touch-icon-180.png">
  <link rel="stylesheet" href="${cssHref}">
  <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2).split('\n').map(l => '  ' + l).join('\n')}
  </script>
</head>
<body>
<a class="skip-link" href="#contenu">Aller au contenu</a>
<header class="site-header">
  <div class="site-header__inner">
    <a class="brand" href="${u.accueil}">${esc(u.marque)}</a>
    <nav class="nav" aria-label="Navigation principale">
${nav}
    </nav>
  </div>
</header>
<main id="contenu">
  <nav class="breadcrumbs" aria-label="Fil d’Ariane">${filDAriane}</nav>
${corps}
</main>
<footer class="site-footer"><div class="site-footer__inner">Trouve ta clinique est un outil d’information et de comparaison, indépendant du gouvernement du Québec et des DTMF. Les fiches regroupent les données du répertoire, des sources publiques et, lorsqu’elles sont disponibles, des informations communiquées par les milieux. Ces renseignements peuvent changer; pour toute décision officielle, validez l’information auprès du milieu, du DTMF ou des sources gouvernementales compétentes.</div></footer>
${corps.includes('badge-verif') ? BADGE_VERIF_SCRIPT + '\n' : ''}${CLOUDFLARE_ANALYTICS}
</body>
</html>
`;
}

/* ------------------------------------------------------------------------------------------- */
/* PAGE D'UNE CLINIQUE                                                                          */
/* ------------------------------------------------------------------------------------------- */

function pageClinique(c, slug, majDonnees, u = UNIVERS_GENERAL) {
  const urlGeneral = `${SITE}/cliniques/${slug}/`;
  const uRegion = UNIVERS_PAR_REGION[c.region];
  const urlRegional = uRegion ? `${SITE}${uRegion.prefixe}/cliniques/${slug}/` : urlGeneral;
  const url = u.regional ? `${SITE}${u.prefixe}/cliniques/${slug}/` : urlGeneral;
  const substance = CHAMPS_SUBSTANCE.filter(k => rempli(c[k])).length;
  const assezRemplie = substance >= SEUIL_INDEXATION;
  const enRecrutement = recrute(c);

  /* BASCULE SEO (21 août 2026, décision d'Olivier ; généralisée le 26 août). Une clinique dont
     le territoire a sa propre carte a DEUX pages : la page générale et la page régionale. Pour
     que Google n'ait jamais à choisir entre deux adresses au contenu identique, une seule des
     deux est officielle. Laquelle, c'est le champ `canonique` de l'univers du territoire qui le
     dit (voir UNIVERS_REGIONS) : la page régionale pour la Montérégie-Est, la page générale
     pour le Centre et l'Ouest. L'autre reste en ligne — aucun lien cassé — mais en noindex, et
     désigne l'officielle comme version de référence, ce qui lui transmet la valeur déjà acquise
     plutôt que de la perdre. */
  const canonical = (uRegion && uRegion.canonique) ? urlRegional : urlGeneral;
  const indexable = assezRemplie && url === canonical;

  /* --- Renseignements, champ par champ, uniquement depuis la liste blanche --- */
  const lignes = [];
  const ajouter = (etiquette, valeur) => {
    if (rempli(valeur)) lignes.push(`      <dt>${esc(etiquette)}</dt><dd>${valeur}</dd>`);
  };

  ajouter('Type de milieu', esc(c.type));
  ajouter('Ville', esc(c.ville));
  ajouter('Adresse', esc(c.adresse));
  ajouter('Territoire', rempli(c.region) ? esc('Montérégie-' + c.region) : '');
  ajouter('Réseau local de services (RLS)', rempli(c.rls)
    ? `<a href="${u.prefixe}/rls/${slugifier(c.rls)}/">${esc(c.rls)}</a>` : '');
  ajouter('Niveau', esc(c.niveau));
  ajouter('Dossier médical électronique (DMÉ)', esc(c.dme));

  if (Array.isArray(c.pratiques) && c.pratiques.length) {
    ajouter('Pratiques offertes',
      esc(c.pratiques.map(p => PRATIQUES[p] || p).join(', ')));
  }
  ajouter('Bureau', esc(c.bureau));
  ajouter('Frais de bureau', esc(c.frais));
  ajouter('Garde à l’urgence', esc(c.gardeUrgence));
  ajouter('Autres gardes', esc(c.gardeAutre));
  ajouter('Porte ouverte', esc(c.porteOuverte));
  ajouter('Site web', rempli(c.site)
    ? `<a href="${esc(c.site)}" rel="noopener nofollow" target="_blank">${esc(c.site)}</a>` : '');
  if (PUBLIER_COURRIELS && rempli(c.personneRessource)) {
    ajouter('Contact recrutement', esc(c.personneRessource));
  }

  /* --- Horaires --- */
  let blocHoraire = '';
  if (rempli(c.horaire)) {
    const rangs = JOURS.filter(j => rempli(c.horaire[j]))
      .map(j => `        <tr><th scope="row">${j}</th><td>${esc(c.horaire[j])}</td></tr>`).join('\n');
    if (rangs) {
      blocHoraire = `
  <section id="horaire">
    <h2>Heures d’ouverture</h2>
    <table class="horaire">
      <tbody>
${rangs}
      </tbody>
    </table>
  </section>`;
    }
  }

  /* --- Équipe --- */
  let blocEquipe = '';
  if (rempli(c.personnel)) {
    const items = Object.keys(PERSONNEL).filter(k => rempli(c.personnel[k]))
      .map(k => `      <li><span class="eq-n">${esc(c.personnel[k])}</span> ${esc(PERSONNEL[k])}</li>`).join('\n');
    if (items) {
      blocEquipe = `
  <section id="equipe">
    <h2>Équipe sur place</h2>
    <ul class="equipe">
${items}
    </ul>
    <p class="note">Composition indiquée dans le répertoire; à confirmer auprès du milieu, puisqu’elle peut évoluer.</p>
  </section>`;
    }
  }

  /* --- Texte libre du milieu (vide pour l'instant dans data.json, apparaîtra tout seul) --- */
  let blocTexte = '';
  if (rempli(c.presentation) || rempli(c.infos)) {
    blocTexte = `
  <section id="presentation">
    <h2>Présentation du milieu</h2>
${rempli(c.presentation) ? '    <p>' + esc(c.presentation) + '</p>' : ''}
${rempli(c.infos) ? '    <p>' + esc(c.infos) + '</p>' : ''}
  </section>`;
  }

  /* --- Données structurées : uniquement ce qu'on sait réellement --- */
  const clinique = {
    '@type': 'MedicalClinic',
    '@id': url + '#clinique',
    name: c.nom,
    url: url,
    address: Object.assign({ '@type': 'PostalAddress' }, decouperAdresse(c.adresse, c.ville))
  };
  if (rempli(c.site)) clinique.sameAs = [c.site];
  if (typeof c.lat === 'number' && typeof c.lng === 'number') {
    clinique.geo = { '@type': 'GeoCoordinates', latitude: c.lat, longitude: c.lng };
  }
  if (rempli(c.horaire)) {
    const specs = [];
    for (const j of JOURS) {
      for (const p of analyserPlages(c.horaire[j] || '')) {
        specs.push({
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: 'https://schema.org/' + JOURS_SCHEMA[j],
          opens: p.opens, closes: p.closes
        });
      }
    }
    if (specs.length) clinique.openingHoursSpecification = specs;
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': url + '#webpage',
        url: url,
        name: enRecrutement
          ? `${c.nom} — clinique en recrutement en Montérégie | Trouve ta clinique`
          : `${c.nom} — clinique de la Montérégie | Trouve ta clinique`,
        inLanguage: 'fr-CA',
        dateModified: majDonnees,
        isPartOf: { '@id': SITE + '/#website' },
        about: { '@id': url + '#clinique' }
      },
      clinique,
      {
        '@type': 'BreadcrumbList',
        itemListElement: u.regional
          ? [
            { '@type': 'ListItem', position: 1, name: u.nom, item: SITE + u.accueil },
            { '@type': 'ListItem', position: 2, name: 'RLS ' + c.rls, item: `${SITE}${u.prefixe}/rls/${slugifier(c.rls || '')}/` },
            { '@type': 'ListItem', position: 3, name: c.nom, item: url }
          ]
          : [
            { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE + '/' },
            { '@type': 'ListItem', position: 2, name: 'Cliniques', item: SITE + '/cliniques/' },
            { '@type': 'ListItem', position: 3, name: c.nom, item: url }
          ]
      }
    ]
  };

  /* 27 août 2026 : un milieu qui ne recrute pas actuellement n'a pas de courriel de recrutement
     à joindre (voir data.json — personneRessource y est vide sur ces 43 fiches). Le bandeau de
     contact est donc remplacé par une simple mention de statut, jamais affiché comme un appel à
     contacter le milieu au sujet d'un recrutement qui n'a pas lieu. */
  const contact = !enRecrutement
    ? `
  <div class="callout"><strong>Ne recrute pas actuellement :</strong> ce milieu est publié à titre de référence dans le répertoire. Consultez la carte interactive pour connaître les milieux du secteur qui recrutent actuellement.</div>`
    : PUBLIER_COURRIELS
    ? ''
    : `
  <div class="callout"><strong>Pour joindre ce milieu au sujet du recrutement :</strong> les coordonnées de la personne-ressource sont affichées dans la fiche de la clinique sur la carte interactive. <a href="${u.accueil}?c=${c.id}">Ouvrir la fiche de ${esc(c.nom)} sur la carte →</a></div>`;

  const corps = `  <section class="hero">
    <p class="eyebrow">${esc(c.type)}${rempli(c.rls) ? ' · RLS ' + esc(c.rls) : ''}${enRecrutement ? '' : ' · Ne recrute pas actuellement'}</p>
    <h1>${esc(c.nom)}${badgeVerif(c)}</h1>
    <p class="lead">${enRecrutement
      ? `${esc(c.nom)} — ${esc(c.type)} situé à ${esc(c.ville)}, en Montérégie — recrute des médecins de famille. Cette page rassemble les renseignements actuellement publiés dans le répertoire pour aider à évaluer le milieu avant de le contacter.`
      : `${esc(c.nom)} — ${esc(c.type)} situé à ${esc(c.ville)}, en Montérégie. Ce milieu ne recrute pas de médecin de famille actuellement; cette page rassemble les renseignements publiés dans le répertoire à titre de référence.`}</p>
    <p class="updated"><strong>Données mises à jour le :</strong> ${esc(majDonnees)}.</p>
    <div class="cta-row">
      <a class="button primary" href="${u.accueil}?c=${c.id}">Voir sur la carte interactive</a>
      ${u.regional
        ? `<a class="button secondary" href="${u.prefixe}/rls/${slugifier(c.rls || '')}/">Autres cliniques du RLS ${esc(c.rls)}</a>`
        : `<a class="button secondary" href="/cliniques/">Toutes les cliniques</a>`}
    </div>
  </section>
${contact}
  <section id="renseignements">
    <h2>Renseignements</h2>
    <dl class="fiche">
${lignes.join('\n')}
    </dl>
  </section>${blocHoraire}${blocEquipe}${blocTexte}
  <div class="data-note"><strong>Source et vérification :</strong> cette fiche reproduit les données actuellement consignées dans le répertoire (date de mise à jour affichée ci-dessus). Certains champs peuvent provenir de sources publiques ou d’informations communiquées par le milieu. Lorsqu’un site officiel est disponible, il est lié dans la section « Renseignements ». Les éléments susceptibles d’évoluer — DMÉ, équipe, frais, horaires et pratiques offertes — doivent être confirmés auprès du milieu; pour le PTEM et les AMP, les sources officielles et le DTMF priment.</div>

  <section id="suite">
    <h2>Pour aller plus loin</h2>
    <ul class="source-list">
      <li><a href="${u.prefixe}/rls/${slugifier(c.rls || '')}/">Autres milieux du RLS ${esc(c.rls)}</a></li>
      <li><a href="${u.prefixe}/ptem/">Comprendre le PTEM et l’avis de conformité</a></li>
      <li><a href="${u.prefixe}/amp/">Comprendre les activités médicales particulières (AMP)</a></li>
      <li><a href="${u.accueil}?c=${c.id}">Fiche complète et itinéraire sur la carte interactive</a></li>
    </ul>
  </section>`;

  return {
    html: page({
      titre: `${c.nom} — ${c.ville} | Trouve ta clinique`,
      description: enRecrutement
        ? `${c.nom}, ${c.type} de ${c.ville} (RLS ${c.rls}) en recrutement de médecins de famille en Montérégie : type de milieu, pratiques offertes${rempli(c.dme) ? ', DMÉ' : ''}${rempli(c.horaire) ? ', heures d’ouverture' : ''}.`
        : `${c.nom}, ${c.type} de ${c.ville} (RLS ${c.rls}) en Montérégie — ne recrute pas de médecin de famille actuellement : type de milieu, coordonnées et heures d’ouverture publiées à titre de référence.`,
      url, canonical, profondeur: 2, indexable, jsonLd, univers: u,
      actif: u.regional ? null : 'cliniques',
      filDAriane: u.regional
        ? `<a href="${u.accueil}">${esc(u.nom)}</a> › <a href="${u.prefixe}/rls/${slugifier(c.rls || '')}/">RLS ${esc(c.rls)}</a> › ${esc(c.nom)}`
        : `<a href="/">Accueil</a> › <a href="/cliniques/">Cliniques</a> › ${esc(c.nom)}`,
      corps
    }),
    indexable, substance
  };
}

/* ------------------------------------------------------------------------------------------- */
/* PAGE D'UN RLS                                                                                */
/* ------------------------------------------------------------------------------------------- */

/*
 * Les 3 RLS de la Montérégie-Est. Demande d'Olivier le 21 août 2026, affinée le même jour après
 * une suggestion (relayée par Olivier) : sur CES pages RLS-là uniquement, on ne renvoie plus vers
 * /cliniques/ (le répertoire des TROIS territoires) — pour ne jamais offrir, même indirectement
 * (via le menu discret « i » de /monteregie-est/ → une de ces 3 pages), un chemin de clic vers les
 * cliniques des autres territoires. Contrairement au premier réflexe (retirer purement et
 * simplement le lien), on le REMPLACE par un lien vers /monteregie-est/ : les pages restent
 * indexables et gardent leur valeur SEO (le maillage interne du site n'est pas amputé), mais pour
 * un visiteur humain qui vient de l'univers Montérégie-Est, tout reste fermé sur ce territoire —
 * fil d'Ariane et bouton renvoient vers la carte Est plutôt que vers le répertoire des 3
 * territoires. Ces 3 RLS sont d'ailleurs exclusivement Montérégie-Est : aucune de leurs cliniques
 * n'appartient à un autre territoire, donc ce cadrage reste cohérent même pour un visiteur venu de
 * la carte générale.
 */
/* Territoire de chaque RLS — DÉDUIT de data.json plutôt qu'écrit à la main : un RLS
   appartient à un seul CISSS, et la liste bougerait à chaque territoire ajouté. Si un RLS
   apparaissait un jour à cheval sur deux territoires (erreur de saisie la plus probable), on
   s'arrête net : tout le cadrage régional en dépend. */
let REGION_DU_RLS = {};
function indexerRlsParRegion(cliniques) {
  const vu = {};
  for (const c of cliniques) {
    if (!rempli(c.rls) || !rempli(c.region)) continue;
    if (vu[c.rls] && vu[c.rls] !== c.region) {
      throw new Error(`RLS « ${c.rls} » rattaché à deux territoires (${vu[c.rls]} et ${c.region}) ` +
                      'dans data.json — corriger la donnée avant de régénérer les pages.');
    }
    vu[c.rls] = c.region;
  }
  REGION_DU_RLS = vu;
}

function pageRls(rls, liste, slugs, majDonnees, u = UNIVERS_GENERAL) {
  const slug = slugifier(rls);
  const urlGeneral = `${SITE}/rls/${slug}/`;
  const uRegion = UNIVERS_PAR_REGION[REGION_DU_RLS[rls]];
  const urlRegional = uRegion ? `${SITE}${uRegion.prefixe}/rls/${slug}/` : urlGeneral;
  const url = u.regional ? `${SITE}${u.prefixe}/rls/${slug}/` : urlGeneral;
  /* Même bascule SEO que pour les fiches de cliniques (voir pageClinique) : c'est le champ
     `canonique` de l'univers du territoire qui désigne l'adresse officielle. */
  const canonical = (uRegion && uRegion.canonique) ? urlRegional : urlGeneral;
  const indexable = url === canonical;
  const villes = [...new Set(liste.map(c => c.ville))].sort((a, b) => a.localeCompare(b, 'fr'));
  const types = [...new Set(liste.map(c => c.type))].sort((a, b) => a.localeCompare(b, 'fr'));
  const prats = [...new Set(liste.flatMap(c => c.pratiques || []))].map(p => PRATIQUES[p] || p).sort();

  /* 27 août 2026 : un RLS peut désormais contenir des milieux qui ne recrutent pas actuellement
     (recrutementActif:false). Ils restent publiés — chacun a sa propre page — mais dans une
     section séparée, sous un titre distinct, pour ne jamais gonfler le compte « qui recrutent »
     annoncé dans le titre et le résumé de cette page. */
  const actifs = liste.filter(recrute);
  const inactifs = liste.filter(c => !recrute(c));
  const villesActifs = [...new Set(actifs.map(c => c.ville))].sort((a, b) => a.localeCompare(b, 'fr'));

  // NB : le badge est un frère de <a>, jamais imbriqué dedans — un <button> à l'intérieur d'un
  // <a> est du HTML invalide (contenu interactif imbriqué) et casserait le clic/le focus.
  const item = c => `      <li>
        <a href="${u.prefixe}/cliniques/${slugs[String(c.id)]}/"><strong>${esc(c.nom)}</strong></a>${badgeVerif(c)}
        <span class="rep-meta">${esc(c.ville)} · ${esc(c.type)}${rempli(c.dme) ? ' · DMÉ ' + esc(c.dme) : ''}${recrute(c) ? '' : ' · Ne recrute pas actuellement'}</span>
      </li>`;
  const items = actifs.map(item).join('\n');
  const itemsInactifs = inactifs.map(item).join('\n');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage', '@id': url + '#webpage', url,
        name: `Cliniques en recrutement — RLS ${rls} | Trouve ta clinique`,
        inLanguage: 'fr-CA', dateModified: majDonnees,
        isPartOf: { '@id': SITE + '/#website' }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: u.regional ? [
          { '@type': 'ListItem', position: 1, name: u.nom, item: SITE + u.accueil },
          { '@type': 'ListItem', position: 2, name: 'RLS ' + rls, item: url }
        ] : [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE + '/' },
          { '@type': 'ListItem', position: 2, name: 'Cliniques', item: SITE + '/cliniques/' },
          { '@type': 'ListItem', position: 3, name: 'RLS ' + rls, item: url }
        ]
      }
    ]
  };

  const corps = `  <section class="hero">
    <p class="eyebrow">Réseau local de services · Montérégie</p>
    <h1>Cliniques en recrutement — RLS ${esc(rls)}</h1>
    <p class="lead">${actifs.length} milieu${actifs.length > 1 ? 'x' : ''} du réseau local de services ${esc(rls)} recrute${actifs.length > 1 ? 'nt' : ''} actuellement des médecins de famille, réparti${actifs.length > 1 ? 's' : ''} dans ${villesActifs.length} municipalité${villesActifs.length > 1 ? 's' : ''} : ${esc(villesActifs.join(', '))}.${inactifs.length ? ` Le RLS compte aussi ${inactifs.length} autre${inactifs.length > 1 ? 's' : ''} milieu${inactifs.length > 1 ? 'x' : ''} publié${inactifs.length > 1 ? 's' : ''} à titre de référence, qui ${inactifs.length > 1 ? 'ne recrutent' : 'ne recrute'} pas actuellement.` : ''}</p>
    <p class="updated"><strong>Données mises à jour le :</strong> ${esc(majDonnees)}.</p>
    <div class="cta-row">
      <a class="button primary" href="${u.accueil}">Voir ce RLS sur la carte</a>
      ${u.regional
        ? `<a class="button secondary" href="${u.prefixe}/ptem/">Comprendre le PTEM</a>`
        : `<a class="button secondary" href="/cliniques/">Toutes les cliniques</a>`}
    </div>
  </section>

  <div class="callout official"><strong>Pourquoi le RLS compte :</strong> l’avis de conformité PTEM précise la région ou le sous-territoire où le médecin doit réaliser au moins 55 % de ses jours de facturation. Le choix du RLS se fait donc en même temps que celui du milieu. <a href="${u.prefixe}/ptem/">Comprendre le PTEM →</a> <a class="source-chip" href="https://www.quebec.ca/gouvernement/travailler-gouvernement/sante-services-sociaux/travailler-comme-medecin-famille-quebec/plans-regionaux-effectifs-medicaux-medecine-famille" rel="noopener">Source officielle</a></div>

  <section id="milieux">
    <h2>Les ${actifs.length} milieu${actifs.length > 1 ? 'x' : ''} qui recrutent</h2>
    <ul class="repertoire">
${items}
    </ul>
  </section>
${inactifs.length ? `
  <section id="autres-milieux">
    <h2>Autres milieux du RLS <span class="compte">${inactifs.length}</span></h2>
    <p class="note">Publiés à titre de référence; ils ne recrutent pas de médecin de famille pour le moment.</p>
    <ul class="repertoire">
${itemsInactifs}
    </ul>
  </section>
` : ''}
  <section id="apercu">
    <h2>Aperçu du territoire</h2>
    <dl class="fiche">
      <dt>Types de milieux représentés</dt><dd>${esc(types.join(', '))}</dd>
      <dt>Municipalités</dt><dd>${esc(villes.join(', '))}</dd>
${prats.length ? `      <dt>Pratiques offertes dans le RLS</dt><dd>${esc(prats.join(', '))}</dd>` : ''}
    </dl>
    <p class="note">Ces éléments sont calculés à partir des fiches publiées ci-dessus; ils décrivent les milieux répertoriés par Trouve ta clinique, pas l’ensemble de l’offre du territoire.</p>
  </section>`;

  return { indexable, html: page({
    titre: `Cliniques en recrutement — RLS ${rls} (Montérégie) | Trouve ta clinique`,
    description: `Les ${actifs.length} cliniques en recrutement de médecins de famille du RLS ${rls}, en Montérégie : ${villesActifs.slice(0, 4).join(', ')}. Type de milieu, pratiques et fiche détaillée pour chacune.${inactifs.length ? ` ${inactifs.length} autre(s) milieu(x) du RLS, publiés à titre de référence, ne recrutent pas actuellement.` : ''}`,
    url, canonical, profondeur: 2, indexable, jsonLd, univers: u,
    actif: u.regional ? null : 'cliniques',
    filDAriane: u.regional
      ? `<a href="${u.accueil}">${esc(u.nom)}</a> › RLS ${esc(rls)}`
      : `<a href="/">Accueil</a> › <a href="/cliniques/">Cliniques</a> › RLS ${esc(rls)}`,
    corps
  }) };
}

/* ------------------------------------------------------------------------------------------- */
/* HUB /monteregie-est/rls/ — les 3 RLS de l'univers Est, uniquement                            */
/* ------------------------------------------------------------------------------------------- */

/*
 * Ajouté le 22 août 2026, à la demande d'Olivier (question posée avant de coder : la décision du
 * 21 août ci-dessus retire volontairement toute entrée « Cliniques » de l'univers Est, pour ne
 * jamais offrir un chemin de clic vers les cliniques des autres territoires). Cette page-ci reste
 * cohérente avec ce choix : elle ne liste QUE les 3 RLS qui sont exclusivement Montérégie-Est
 * (REGION_DU_RLS) et ne pointe jamais ailleurs que dans son propre univers (carte, PTEM, AMP,
 * pages de RLS du territoire). Pas d'entrée dans la barre de navigation (actif reste null, comme
 * pageRls) : la page existe pour le maillage interne et le sitemap, pas comme onglet visible.
 * Généralisée aux trois territoires le 26 août 2026.
 */
function pageRlsHubRegion(u, parRls, majDonnees) {
  const url = `${SITE}${u.prefixe}/rls/`;

  const rangRls = rls => { const i = u.ordreRls.indexOf(rls); return i === -1 ? 99 : i; };
  const rlsPresents = [...parRls.keys()]
    .filter(rls => REGION_DU_RLS[rls] === u.region)
    .sort((a, b) => rangRls(a) - rangRls(b) || a.localeCompare(b, 'fr'));

  /* Ce hub reste focalisé sur le recrutement (voir son titre et son texte) : le compte affiché
     par RLS, et le total ci-dessous, ne portent donc que sur les milieux en recrutement — les
     milieux qui ne recrutent pas actuellement (recrutementActif:false) restent listés sur leur
     propre page de RLS (voir pageRls), pas ici. */
  const sections = rlsPresents.map(rls => {
    const liste = parRls.get(rls).filter(recrute);
    const villes = [...new Set(liste.map(c => c.ville))].sort((a, b) => a.localeCompare(b, 'fr'));
    return `  <section id="rls-${slugifier(rls)}">
    <h2>RLS ${esc(rls)} <span class="compte">${liste.length}</span></h2>
    <p class="rep-lien">${esc(villes.join(', '))}</p>
    <p class="rep-lien"><a href="${u.prefixe}/rls/${slugifier(rls)}/">Voir les ${liste.length} milieu${liste.length > 1 ? 'x' : ''} en recrutement du RLS ${esc(rls)} →</a></p>
  </section>`;
  }).join('\n\n');

  const total = rlsPresents.reduce((n, rls) => n + parRls.get(rls).filter(recrute).length, 0);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage', '@id': url + '#webpage', url,
        name: `Réseaux locaux de services (RLS) — ${u.nom} | Trouve ta clinique`,
        inLanguage: 'fr-CA', dateModified: majDonnees,
        isPartOf: { '@id': SITE + '/#website' }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: u.nom, item: SITE + u.accueil },
          { '@type': 'ListItem', position: 2, name: 'RLS', item: url }
        ]
      }
    ]
  };

  const corps = `  <section class="hero">
    <p class="eyebrow">Réseaux locaux de services · ${esc(u.nom)}</p>
    <h1>Les RLS de la ${esc(u.nom)}</h1>
    <p class="lead">Le territoire de la ${esc(u.nom)} compte <strong>${rlsPresents.length} ${rlsPresents.length > 1 ? 'réseaux locaux' : 'réseau local'} de services</strong>, avec au total ${total} milieu${total > 1 ? 'x' : ''} actuellement en recrutement de médecins de famille.</p>
    <p class="updated"><strong>Données mises à jour le :</strong> ${esc(majDonnees)}.</p>
    <div class="cta-row">
      <a class="button primary" href="${u.accueil}">Voir sur la carte interactive</a>
      <a class="button secondary" href="${u.prefixe}/ptem/">Comprendre le PTEM</a>
    </div>
  </section>

${sections}`;

  return page({
    titre: `Réseaux locaux de services (RLS) — ${u.nom} | Trouve ta clinique`,
    description: `Les ${rlsPresents.length} RLS de la ${u.nom} et leurs milieux en recrutement de médecins de famille.`,
    /* Indexable seulement là où le territoire tient aussi ses pages de RLS (voir `canonique`) :
       sinon ce hub renverrait Google vers des pages qu'on a nous-mêmes mises en noindex. */
    url, profondeur: 1, indexable: u.canonique, jsonLd, univers: u, actif: null,
    filDAriane: `<a href="${u.accueil}">${esc(u.nom)}</a> › RLS`,
    corps
  });
}

/* ------------------------------------------------------------------------------------------- */
/* RÉPERTOIRE /cliniques/                                                                       */
/* ------------------------------------------------------------------------------------------- */

function pageRepertoire(cliniques, slugs, parRls, majDonnees) {
  const url = `${SITE}/cliniques/`;
  const villes = new Set(cliniques.map(c => c.ville));

  const enRecrutementTotal = cliniques.filter(recrute).length;
  const sections = [...parRls.keys()].sort((a, b) => a.localeCompare(b, 'fr')).map(rls => {
    const liste = parRls.get(rls);
    const items = liste.map(c => `      <li>
        <a href="/cliniques/${slugs[String(c.id)]}/"><strong>${esc(c.nom)}</strong></a>${badgeVerif(c)}
        <span class="rep-meta">${esc(c.ville)} · ${esc(c.type)}${recrute(c) ? '' : ' · Ne recrute pas actuellement'}</span>
      </li>`).join('\n');
    return `  <section id="rls-${slugifier(rls)}">
    <h2>RLS ${esc(rls)} <span class="compte">${liste.length}</span></h2>
    <p class="rep-lien"><a href="/rls/${slugifier(rls)}/">Voir la page du RLS ${esc(rls)} →</a></p>
    <ul class="repertoire">
${items}
    </ul>
  </section>`;
  }).join('\n\n');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage', '@id': url + '#webpage', url,
        name: 'Cliniques en recrutement en Montérégie | Trouve ta clinique',
        inLanguage: 'fr-CA', dateModified: majDonnees,
        isPartOf: { '@id': SITE + '/#website' }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE + '/' },
          { '@type': 'ListItem', position: 2, name: 'Cliniques', item: url }
        ]
      }
    ]
  };

  const corps = `  <section class="hero">
    <p class="eyebrow">Médecine familiale · Montérégie</p>
    <h1>Cliniques en recrutement en Montérégie</h1>
    <p class="lead">Les <strong>${cliniques.length} milieux actuellement publiés</strong> dans le répertoire, regroupés dans <strong>${parRls.size} RLS</strong> et ${villes.size} municipalités — dont ${enRecrutementTotal} en recrutement actif de médecins de famille${enRecrutementTotal < cliniques.length ? `, les autres étant publiés à titre de référence` : ''}. Chaque fiche permet de comparer les caractéristiques disponibles; la <a href="/">carte interactive</a> ajoute les filtres et la vue géographique.</p>
    <p class="updated"><strong>Données mises à jour le :</strong> ${esc(majDonnees)}.</p>
    <div class="cta-row">
      <a class="button primary" href="/">Explorer sur la carte interactive</a>
      <a class="button secondary" href="/ptem/">Guide PTEM</a>
    </div>
  </section>

  <figure class="visual-banner compact directory-banner"><a href="/" aria-label="Ouvrir la carte interactive"><img src="../assets/carte-interactive-monteregie.png" alt="Bannière de la carte interactive Trouve ta clinique" width="1920" height="640" loading="lazy"></a><figcaption>Le répertoire HTML et la carte sont deux vues complémentaires des mêmes milieux publiés.</figcaption></figure>

  <div class="callout official"><strong>Comment choisir :</strong> le RLS peut être déterminant pour l’avis de conformité PTEM, qui exige au moins 55 % des jours de facturation dans le territoire visé. Le type de milieu (GMF, GMF-U, CLSC…), le DMÉ, les frais de bureau et les pratiques offertes aident ensuite à comparer le quotidien de pratique. <a class="source-chip" href="https://www.quebec.ca/gouvernement/travailler-gouvernement/sante-services-sociaux/travailler-comme-medecin-famille-quebec/plans-regionaux-effectifs-medicaux-medecine-famille" rel="noopener">Source officielle</a></div>

${sections}`;

  return page({
    titre: 'Cliniques en recrutement en Montérégie | Trouve ta clinique',
    description: `Répertoire des ${cliniques.length} milieux publiés en Montérégie (dont ${enRecrutementTotal} en recrutement actif de médecins de famille), classés par ${parRls.size} RLS avec fiche détaillée.`,
    url, profondeur: 1, indexable: true, jsonLd, actif: 'cliniques',
    filDAriane: `<a href="/">Accueil</a> › Cliniques`,
    corps
  });
}

/* ------------------------------------------------------------------------------------------- */
/* SITEMAP                                                                                      */
/* ------------------------------------------------------------------------------------------- */

/* Pages de contenu écrites à la main (pas générées). Ajouter ici toute nouvelle page-guide. */
const PAGES_FIXES = [
  { loc: '/', lastmod: null, changefreq: 'weekly', priority: '1.0' },
  { loc: '/ptem/', lastmod: '2026-08-19', changefreq: 'weekly', priority: '0.9' },
  { loc: '/amp/', lastmod: '2026-08-19', changefreq: 'monthly', priority: '0.9' },
  // Copie dédiée de la carte, filtrée à la Montérégie-Est — voir MODE_EST dans index.html et
  // scripts/publier-monteregie-est.js. Priorité un peu sous « / » : c'est une vue du même
  // contenu, pas une page distincte à privilégier dans les résultats de recherche.
  { loc: '/monteregie-est/', lastmod: '2026-08-20', changefreq: 'weekly', priority: '0.8' }
];

function sitemap(entrees) {
  const urls = entrees.map(e => `  <url>
    <loc>${SITE}${e.loc}</loc>
    <lastmod>${e.lastmod}</lastmod>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Généré automatiquement par scripts/generer-pages-seo.js — ne pas modifier à la main. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

/* ------------------------------------------------------------------------------------------- */
/* PROGRAMME PRINCIPAL                                                                          */
/* ------------------------------------------------------------------------------------------- */

function ecrire(relatif, contenu) {
  const cible = path.join(RACINE, relatif);
  fs.mkdirSync(path.dirname(cible), { recursive: true });
  fs.writeFileSync(cible, contenu, 'utf8');
}

/* ------------------------------------------------------------------------------------------- */
/* COPIES ÉTANCHES DE /ptem/ ET /amp/ POUR L'UNIVERS MONTÉRÉGIE-EST                             */
/* ------------------------------------------------------------------------------------------- */

/*
 * /ptem/ et /amp/ sont deux pages écrites à la main (elles ne sortent pas de data.json). Pour
 * l'univers Est, on n'en réécrit pas le contenu — il est neutre, il vaut pour toute la
 * Montérégie — on en fabrique une copie dont la NAVIGATION reste dans l'univers Est :
 *   - la marque, le fil d'Ariane et « Carte des cliniques » renvoient vers /monteregie-est/;
 *   - les liens /ptem/ ↔ /amp/ pointent vers leurs copies Est;
 *   - tout lien vers /cliniques/ (le répertoire des trois territoires) est SUPPRIMÉ.
 *
 * Contrairement aux fiches de cliniques et aux pages de RLS, ces deux copies ne prennent PAS la
 * main côté référencement : leur contenu n'a rien de propre à l'Est, donc la page officielle
 * pour Google reste /ptem/ et /amp/. Les copies sont en noindex et la désignent comme telle.
 * Elles n'existent que pour ne pas faire sortir de l'univers Est quelqu'un qui vient d'y entrer.
 */
function copieRegionPageStatique(source, urlCanonique, u) {
  let html = fs.readFileSync(path.join(RACINE, source), 'utf8');
  const avant = html;

  /* 1. Aucun lien vers le répertoire des trois territoires — on retire l'ancre en entier
        (nav et boutons d'appel à l'action), plutôt que de la faire pointer ailleurs. */
  html = html.replace(/<a\b[^>]*href="\/cliniques\/"[^>]*>.*?<\/a>/gs, '');

  /* 2. Les liens restants sont ramenés dans l'univers du territoire. L'ordre compte : /ptem/ et
        /amp/ d'abord, sinon la règle sur href="/" ne les toucherait pas mais celle-ci les
        préfixerait deux fois. */
  html = html.replace(/href="\/(ptem|amp)\/"/g, `href="${u.prefixe}/$1/"`);
  html = html.replace(/href="\/"/g, `href="${u.accueil}"`);

  /* 3. Ressources (CSS, images) : la page d'origine vit à /ptem/, la copie à /monteregie-est/ptem/
        — un cran plus profond. Les chemins en « ../assets/… » y résoudraient vers
        /monteregie-est/assets/, qui n'existe pas : la page s'afficherait sans aucune mise en
        forme. On les passe en absolu, seule forme juste quelle que soit la profondeur. */
  html = html.replace(/(href|src)="\.\.\/assets\//g, '$1="/assets/');

  /* 3bis. Bannière : PTEM et AMP illustrent leur en-tête avec la bannière générale de la carte
     (carte-interactive-monteregie.png). Sur les copies Est, demande d'Olivier du 21 août : la
     bannière déjà préparée pour la Montérégie-Est (banniere_monteregie-est.png, 20 août) doit
     apparaître à la place — cohérent avec le reste de l'univers Est. Les territoires qui n'ont
     pas encore de bannière propre gardent l'image générale : mieux vaut une illustration
     générique correcte qu'un lien mort vers un fichier inexistant. */
  if (u.banniere) {
    html = html.replace(/carte-interactive-monteregie\.png/g, u.banniere.fichier);
  }
  html = html.replace(
    /Bannière Trouve ta clinique — carte interactive des cliniques en recrutement en Montérégie/g,
    `Bannière Trouve ta clinique — carte interactive des cliniques en recrutement en ${u.nom}`
  );

  /* 4. Identité du territoire dans l'en-tête et le fil d'Ariane. */
  const acc = u.accueil.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  html = html.replace(new RegExp(`(<a class="brand" href="${acc}">)Trouve ta clinique(</a>)`),
                      `$1${u.marque}$2`);
  html = html.replace(new RegExp(`(href="${acc}">)Carte des cliniques(</a>)`),
                      `$1Carte ${u.nom}$2`);
  html = html.replace(new RegExp(`(class="breadcrumbs"><a href="${acc}">)Accueil(</a>)`),
                      `$1${u.nom}$2`);

  /* 5. Indexation : la page officielle reste la page générale (voir le commentaire ci-dessus). */
  html = html.replace(/<link href="[^"]*" rel="canonical"\/>/,
                      `<link href="${urlCanonique}" rel="canonical"/>`);
  html = html.replace(/<meta content="index,follow[^"]*" name="robots"\/>/,
                      '<meta content="noindex,follow" name="robots"/>');

  /* 5bis. Aperçu de partage (og:image / twitter:image) : la bannière du territoire plutôt que
     celle de la carte générale, pour les mêmes raisons qu'au point 3bis (22 août). */
  if (u.banniere) {
    html = html.replace(/<meta content="[^"]*og-image\.png\?v=2" (property="og:image"|name="twitter:image")\/>/g,
                        `<meta content="${SITE}/assets/${u.banniere.fichier}" $1/>`);
    html = html.replace(/<meta content="1200" property="og:image:width"\/>/,
                        `<meta content="${u.banniere.largeur}" property="og:image:width"/>`);
    html = html.replace(/<meta content="630" property="og:image:height"\/>/,
                        `<meta content="${u.banniere.hauteur}" property="og:image:height"/>`);
  }
  html = html.replace(/<meta content="Carte des cliniques en recrutement de la Montérégie — Trouve ta clinique\." property="og:image:alt"\/>/,
                      `<meta content="Carte interactive ${u.nom} — Trouve ta clinique." property="og:image:alt"/>`);

  if (html === avant) {
    throw new Error(`copieRegionPageStatique : aucune transformation appliquée à ${source} — ` +
                    'le gabarit de la page a probablement changé, la copie régionale ne serait plus étanche.');
  }
  return html;
}

function main() {
  const donnees = JSON.parse(fs.readFileSync(path.join(RACINE, 'data.json'), 'utf8'));
  const majDonnees = donnees.miseAJour || new Date().toISOString().slice(0, 10);

  /* Date du dernier changement de gabarit (texte/CSS des pages, indépendant des données de clinique).
     Une refonte du gabarit modifie aussi le contenu HTML, même si data.json n'a pas changé — le
     sitemap doit donc en tenir compte pour son lastmod. Mettre à jour cette date à la main lors
     d'une prochaine modification des templates ci-dessous. */
  const majGabaritsSeo = '2026-08-21';
  const majPagesSeo = [majDonnees, majGabaritsSeo].sort().at(-1);

  const toutes = donnees.cliniques || [];
  const cliniques = toutes.filter(c => c.visible !== false && rempli(c.nom));
  const ignorees = toutes.length - cliniques.length;

  /* Slugs stables */
  const fichierSlugs = path.join(__dirname, 'slugs.json');
  const slugs = chargerSlugs(fichierSlugs);
  const nouveaux = attribuerSlugs(cliniques, slugs);
  fs.writeFileSync(fichierSlugs, JSON.stringify(slugs, null, 2) + '\n', 'utf8');

  /* Vérification : aucun champ hors liste blanche ne doit exister sans qu'on le sache */
  const champsVus = new Set();
  cliniques.forEach(c => Object.keys(c).forEach(k => champsVus.add(k)));
  const horsListe = [...champsVus].filter(k => !CHAMPS_PUBLICS.includes(k));

  /* Tri : par ville puis par nom, comme la liste existante */
  const ordre = (a, b) => (a.ville || '').localeCompare(b.ville || '', 'fr') ||
                          (a.nom || '').localeCompare(b.nom || '', 'fr');
  cliniques.sort(ordre);

  /* Regroupement par RLS */
  const parRls = new Map();
  for (const c of cliniques) {
    if (!rempli(c.rls)) continue;
    if (!parRls.has(c.rls)) parRls.set(c.rls, []);
    parRls.get(c.rls).push(c);
  }

  /* Territoire de chaque RLS — à établir AVANT toute génération : pageRls, le hub régional et
     le choix des adresses canoniques en dépendent tous. */
  indexerRlsParRegion(cliniques);

  const entrees = PAGES_FIXES.map(p => Object.assign({}, p, { lastmod: p.lastmod || majPagesSeo }));
  entrees.push({ loc: '/cliniques/', lastmod: majPagesSeo, changefreq: 'weekly', priority: '0.8' });

  /* Pages de cliniques — version générale, puis copie étanche dans l'univers du territoire.
     Une seule des deux entre dans le sitemap : celle qui est indexable (voir pageClinique). */
  let indexables = 0, minces = [], copiesRegionales = 0;
  const dejaMince = new Set();
  const noterMince = c => {
    if (dejaMince.has(c.id)) return;      // une même fiche n'est signalée qu'une fois,
    dejaMince.add(c.id);                  // même si ses deux versions sont trop minces
    minces.push({ nom: c.nom, substance: CHAMPS_SUBSTANCE.filter(k => rempli(c[k])).length });
  };
  for (const c of cliniques) {
    const slug = slugs[String(c.id)];

    const general = pageClinique(c, slug, majDonnees, UNIVERS_GENERAL);
    ecrire(path.join('cliniques', slug, 'index.html'), general.html);
    if (general.indexable) {
      indexables++;
      entrees.push({ loc: `/cliniques/${slug}/`, lastmod: majPagesSeo, changefreq: 'monthly', priority: '0.7' });
    } else if (general.substance < SEUIL_INDEXATION) {
      noterMince(c);
    }

    const uRegion = UNIVERS_PAR_REGION[c.region];
    if (uRegion) {
      const reg = pageClinique(c, slug, majDonnees, uRegion);
      ecrire(path.join(uRegion.dossier, 'cliniques', slug, 'index.html'), reg.html);
      copiesRegionales++;
      if (reg.indexable) {
        indexables++;
        entrees.push({ loc: `${uRegion.prefixe}/cliniques/${slug}/`, lastmod: majPagesSeo, changefreq: 'monthly', priority: '0.7' });
      } else if (reg.substance < SEUIL_INDEXATION) {
        noterMince(c);
      }
    }
  }

  /* Pages de RLS — même principe. */
  for (const [rls, liste] of parRls) {
    const slug = slugifier(rls);

    const general = pageRls(rls, liste, slugs, majDonnees, UNIVERS_GENERAL);
    ecrire(path.join('rls', slug, 'index.html'), general.html);
    if (general.indexable) {
      entrees.push({ loc: `/rls/${slug}/`, lastmod: majPagesSeo, changefreq: 'weekly', priority: '0.8' });
    }

    const uRegion = UNIVERS_PAR_REGION[REGION_DU_RLS[rls]];
    if (uRegion) {
      const reg = pageRls(rls, liste, slugs, majDonnees, uRegion);
      ecrire(path.join(uRegion.dossier, 'rls', slug, 'index.html'), reg.html);
      copiesRegionales++;
      if (reg.indexable) {
        entrees.push({ loc: `${uRegion.prefixe}/rls/${slug}/`, lastmod: majPagesSeo, changefreq: 'weekly', priority: '0.8' });
      }
    }
  }

  /* Copies étanches de /ptem/ et /amp/ dans chaque univers régional (noindex : voir la
     fonction). Sans elles, le menu « i » d'une carte régionale — qui pointe en relatif vers
     ptem/ et amp/ — donnerait deux liens morts. */
  for (const u of UNIVERS_REGIONS) {
    for (const nom of ['ptem', 'amp']) {
      ecrire(path.join(u.dossier, nom, 'index.html'),
             copieRegionPageStatique(path.join(nom, 'index.html'), `${SITE}/${nom}/`, u));
      copiesRegionales++;
    }
  }

  /* Répertoire général + hub RLS de chaque univers régional + sitemap */
  ecrire(path.join('cliniques', 'index.html'), pageRepertoire(cliniques, slugs, parRls, majDonnees));
  for (const u of UNIVERS_REGIONS) {
    const hub = pageRlsHubRegion(u, parRls, majDonnees);
    ecrire(path.join(u.dossier, 'rls', 'index.html'), hub);
    copiesRegionales++;
    if (u.canonique) {
      entrees.push({ loc: `${u.prefixe}/rls/`, lastmod: majPagesSeo, changefreq: 'weekly', priority: '0.8' });
    }
  }
  ecrire('sitemap.xml', sitemap(entrees));

  /* Rapport */
  console.log('=== GÉNÉRATION DES PAGES SEO ===');
  console.log(`data.json du ${majDonnees} — ${toutes.length} fiches, ${cliniques.length} publiées${ignorees ? `, ${ignorees} ignorée(s) (visible:false)` : ''} (dont ${cliniques.filter(recrute).length} en recrutement, ${cliniques.filter(c => !recrute(c)).length} hors recrutement)`);
  console.log(`Pages de cliniques : ${cliniques.length} générées, ${indexables} indexables, ${minces.length} en noindex (moins de ${SEUIL_INDEXATION} champs remplis)`);
  console.log(`Pages de RLS       : ${parRls.size}`);
  console.log(`Répertoire         : cliniques/index.html`);
  console.log(`Sitemap            : ${entrees.length} URL`);
  console.log(`Courriels publiés  : ${PUBLIER_COURRIELS ? 'OUI' : 'non (choix du 19 août 2026)'}`);
  if (nouveaux.length) {
    console.log(`\nNouveaux slugs attribués (${nouveaux.length}) — désormais figés :`);
    nouveaux.forEach(n => console.log(`  id ${n.id} → /cliniques/${n.slug}/   (${n.nom})`));
  } else {
    console.log('\nAucun nouveau slug : toutes les URL existantes sont conservées telles quelles.');
  }
  if (minces.length) {
    console.log(`\nFiches trop minces pour l'indexation (page créée, mais noindex + hors sitemap) :`);
    minces.forEach(m => console.log(`  ${m.substance} champs — ${m.nom}`));
    console.log(`  → elles redeviendront indexables toutes seules dès qu'elles atteindront ${SEUIL_INDEXATION} champs dans data.json.`);
  }
  if (horsListe.length) {
    console.log(`\nChamps de data.json NON publiés (hors liste blanche, normal) : ${horsListe.join(', ')}`);
  }
}

main();
