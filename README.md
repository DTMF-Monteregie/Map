# PTEM 2027 — Carte des cliniques en recrutement

Carte web interactive des cliniques en recrutement médical de la **Montérégie**, sur les
trois territoires : Montérégie-Est, Montérégie-Centre et Montérégie-Ouest.

**En ligne :** https://dtmf-monteregie.github.io/Map/

Le plan territorial d'effectifs médicaux (PTEM) 2027 est en vigueur du 1<sup>er</sup> décembre 2026
au 30 novembre 2027.

## Aperçu

Application web progressive (PWA) autonome qui affiche, sur une carte Leaflet, les cliniques
en recrutement avec leurs coordonnées, leur région, leur réseau local de services (RLS), leur
niveau GMF, leurs pratiques, leur horaire et leur personnel. L'utilisateur peut filtrer par
région et par RLS, ajouter des favoris, prendre des notes personnelles (stockées sur son
appareil) et exporter un comparatif de ses favoris en PDF.

Les points de service en recrutement, répartis sur les **9 RLS** de la Montérégie.
Le nombre exact est affiché dans l'application, calculé à partir de `data.json` — il n'est
écrit en dur nulle part, pour ne pas dériver à chaque ajout ou retrait de fiche.


| Région | RLS |
|---|---|
| Montérégie-Est | Pierre-Boucher, Richelieu-Yamaska, Pierre-De Saurel |
| Montérégie-Centre | Champlain, Haut-Richelieu–Rouville |
| Montérégie-Ouest | Jardins-Roussillon, Haut-Saint-Laurent, Suroît, Vaudreuil-Soulanges |

## Caractéristiques

- 100 % statique — aucun serveur, aucune base de données.
- Fonctionne **hors ligne** (service worker ; Leaflet et les images sont dans le dépôt, les
  polices viennent de Google Fonts et retombent sur les polices système hors ligne).
- Installable comme application (PWA) sur mobile et ordinateur.
- Favoris, notes et ordre personnalisé stockés **localement** (`localStorage`) — rien n'est transmis.
- Comparatif imprimable / exportable en PDF (orientation automatique).
- Bouton de partage : partage natif du système, avec repli sur la copie du lien.
- Interface en français, conçue pour le contexte québécois.

## Pile technique

HTML / CSS / JavaScript « vanilla » (sans cadriciel ni étape de compilation),
[Leaflet](https://leafletjs.com/) pour la carte, polices Raleway + Lato chargées depuis
Google Fonts.

### Fichiers de la racine

| Fichier | Rôle |
|---|---|
| `index.html` | toute l'application : balisage, styles, scripts et images (encodées à l'intérieur) |
| `data.json` | **la seule source de contenu** — voir le schéma plus bas |
| `sw.js` | service worker : cache hors ligne, liste `CORE` des fichiers préchargés |
| `leaflet.js`, `leaflet.css` | bibliothèque de carte, copie locale |
| `manifest.json`, `icon-*.png`, `favicon-*.png` | installation en application (PWA) |

> **Toute nouvelle ressource statique doit être ajoutée à `CORE` dans `sw.js`**, sinon elle
> manquera hors ligne.

> **Les polices viennent de `fonts.googleapis.com`.** Hors ligne, la typographie retombe donc
> sur les polices système : l'application reste utilisable, mais l'identité visuelle change.
> Les héberger dans le dépôt corrigerait ce point et supprimerait l'appel à un tiers — c'est
> une amélioration possible, volontairement laissée de côté pour l'instant afin de garder le
> déploiement à trois fichiers.

## Mettre à jour les données

Toutes les données vivent dans **`data.json`**. Pour modifier l'annonce ou une clinique,
on édite ce fichier ; le service worker le recharge en priorité réseau, donc les changements
sont visibles immédiatement, **sans toucher à la version du cache**.

### Schéma de `data.json`

```jsonc
{
  "miseAJour": "AAAA-MM-JJ",
  "annonce": {
    "titre": "Prochaine activité de recrutement",  // optionnel — titre de la bannière
    "texte": "Texte de la bannière (optionnel). **gras** possible.",
    "lien": "https://... (optionnel) — bouton « S'inscrire »",
    "lienCarte": "https://... (optionnel) — bouton « Itinéraire »",
    "dateFin": "AAAA-MM-JJ"   // optionnel — dernier jour d'affichage, la bannière
                              // disparaît d'elle-même le lendemain
  },
  "cliniques": [
    {
      "id": 1,                       // requis — identifiant unique (nombre)
      "nom": "GMF Exemple",          // requis
      "visible": true,               // requis — false = fiche conservée mais masquée
      "type": "GMF",                 // requis — GMF, GMF-U, GMF-R, CLSC,
                                     //          Clinique médicale, Coopérative, CH
      "region": "Centre",            // requis — Est | Centre | Ouest
      "rls": "Champlain",            // requis — l'un des 9 RLS (voir le tableau plus haut)
      "lat": 45.50,                  // requis — latitude (nombre)
      "lng": -73.43,                 // requis — longitude (nombre)
      "alias": "",                   // optionnel — mots-clés supplémentaires pour la recherche
      "niveaux": {                   // optionnel — une rangée par niveau rempli
        "gmf": "12", "accesReseau": "4", "gmfu": ""
      },
      "niveau": "GMF 12 · Accès-réseau 4",  // DÉRIVÉ de « niveaux » — sert au comparatif
                                            // et de repli pour les versions en cache
      "adresse": "",                 // optionnel
      "ville": "Brossard",           // optionnel
      "site": "",                    // optionnel
      "personneRessource": "",       // optionnel — courriel de recrutement affiché
      "dme": "",                     // optionnel — dossier médical électronique
      "porteOuverte": "",            // optionnel — date en clair, ex. « 16 juillet 2026 » ;
                                     // la rangée disparaît si la date est passée
      "bureau": "",                  // optionnel — Bureau dédié | partagé | dédié ou partagé
      "frais": "",                   // optionnel — modalité, jamais un montant (voir plus bas)
      "medecinsRecherches": "",      // optionnel — nombre de médecins recherchés
      "pratiques": ["pec", "gap"],   // optionnel — codes : pec, gap, sad, peri, msk, chir
      "gardeUrgence": "",            // optionnel — fréquence de garde urgence mineure
      "gardeAutre": "",              // optionnel — autre type de garde
      "horaire": {                   // optionnel — par jour
        "Lundi": "8h00 – 17h00", "Mardi": "", "Mercredi": "", "Jeudi": "",
        "Vendredi": "", "Samedi": "Fermé", "Dimanche": "Fermé"
      },
      "personnel": {                 // optionnel
        "medecins": "", "residents": "", "specialistes": "", "ipspl": "",
        "infirmieres": "", "infauxiliaires": "", "physiotherapeutes": "",
        "pharmaciennes": "", "nutritionnistes": "", "psychologues": "",
        "travailleuresSociales": "", "intervenantspsychosociaux": ""
      },
      "infos": "",                   // optionnel — information publique sur la clinique
      "presentation": "",            // optionnel — mot de présentation rédigé PAR LE MILIEU
      "notes": "",                   // ignoré à l'affichage : les notes sont locales à l'utilisateur
      "posApprox": false             // optionnel — true = position estimée, non géocodée.
                                     //   La fiche affiche alors « position approximative »
                                     //   à côté de l'adresse.
    }
  ]
}
```


Un champ vide s'affiche comme « À venir ». Plusieurs champs vides qui se suivent sont
regroupés en une seule rangée. Les codes de pratique : `pec` (prise en charge),
`gap` (guichet d'accès à la première ligne), `sad` (soins à domicile), `peri` (périnatalité),
`msk` (musculosquelettique), `chir` (chirurgie mineure).

> **Aucun montant, aucune donnée personnelle dans `data.json`.** Le fichier est public :
> n'importe qui peut le télécharger. Les montants de loyer, les clauses négociées et les
> courriels personnels non autorisés n'y ont pas leur place. Le champ `frais` porte la
> *modalité* (« Société de dépense », « Aucun frais »), jamais le montant.

> **`presentation` appartient au milieu.** Ce texte est publié tel quel, attribué à la
> clinique. Il ne doit contenir que ce que le milieu a lui-même écrit ou validé — pas des
> notes de visite reformulées.

> **`infos` et `notes` ne sont pas interchangeables.** `notes` alimente le bloc « Mes notes »,
> que l'application écrase avec les notes locales de chaque personne : tout ce qu'on y écrit
> est invisible. L'information publique sur une clinique va dans `infos`.

## Cycle de collecte

Les données ne se saisissent pas dans `data.json` : elles vivent dans le classeur Google
« PTEM 2027 — Base maître des cliniques de la Montérégie », et `data.json` en est l'export.
Le cycle, entièrement piloté par le menu **PTEM 2027** du classeur :

1. **① Marquer un RLS comme envoyé** — au moment de transmettre la liste de liens préremplis
   au technicien du RLS. Met à jour le statut et la date d'envoi, ce qui alimente l'onglet « Suivi ».
2. **② Intégrer les réponses** — lit l'onglet « Réponses brutes » et **propose** les écarts dans
   l'onglet « Révision ». N'écrit rien dans la base maître.
3. *(relecture humaine : on coche dans « Révision » ce qu'on accepte)*
4. **③ Appliquer les révisions approuvées** — reporte uniquement les lignes cochées.
5. **④ Préparer l'export data.json** — produit le fichier dans le Drive, à déposer ici.

Aucune étape n'envoie de courriel, ne partage de fichier ni ne publie quoi que ce soit :
la publication est toujours un geste manuel.

## Déploiement

Le dépôt est publié via **GitHub Pages**, directement depuis la branche `main`.
Il n'y a ni intégration continue ni étape de compilation : téléverser les fichiers suffit.

Après toute modification du **code** (`index.html`, `sw.js`, icônes…), il faut incrémenter
la version du cache dans `sw.js`, sinon les personnes qui ont déjà ouvert l'application
continueront de voir l'ancienne :

```js
const CACHE = 'ptem-2027-v15';   //  ->  'ptem-2027-v16'
```

Ce n'est pas nécessaire pour `data.json`, qui est toujours rechargé depuis le réseau.

## Développement local

Servir le dossier avec n'importe quel serveur statique, par exemple :

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

Un fichier ouvert directement (`file://`) ne fonctionnera pas : le service worker et
`fetch()` exigent une origine http(s).

## Renommage annuel

Le nom « PTEM 2027 » apparaît à six endroits, tous signalés par un commentaire en tête
d'`index.html` : le `<title>`, les métadonnées `og:` et `twitter:`, l'infobulle du bouton
« i », l'objet du courriel de correction, le `console.log` final et `manifest.json`.

**À ne pas renommer :** les clés `localStorage` `dtmf-mtg-*` (les favoris et les notes de
tout le monde seraient perdus), le champ `id` du manifeste, et les adresses du dépôt.

## Vie privée

Aucune donnée utilisateur n'est collectée ni transmise. Les favoris, les notes et l'ordre
personnalisé restent dans le navigateur de chaque personne (`localStorage`).

## Licence

Voir le fichier [LICENSE](LICENSE).
