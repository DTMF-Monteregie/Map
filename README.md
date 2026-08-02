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

**55 points de service** répartis sur **6 RLS** :

| Région | RLS |
|---|---|
| Montérégie-Est | Pierre-Boucher, Richelieu-Yamaska, Pierre-De Saurel |
| Montérégie-Centre | Champlain, Haut-Richelieu–Rouville |
| Montérégie-Ouest | Jardins-Roussillon |

## Caractéristiques

- 100 % statique — aucun serveur, aucune base de données.
- Fonctionne **hors ligne** (service worker ; Leaflet et les polices sont hébergés localement).
- Installable comme application (PWA) sur mobile et ordinateur.
- Favoris, notes et ordre personnalisé stockés **localement** (`localStorage`) — rien n'est transmis.
- Comparatif imprimable / exportable en PDF (orientation automatique).
- Bouton de partage : partage natif du système, avec repli sur la copie du lien.
- Interface en français, conçue pour le contexte québécois.

## Pile technique

HTML / CSS / JavaScript « vanilla » (sans cadriciel ni étape de compilation),
[Leaflet](https://leafletjs.com/) pour la carte, polices Raleway + Lato auto-hébergées.

## Mettre à jour les données

Toutes les données vivent dans **`data.json`**. Pour modifier l'annonce ou une clinique,
on édite ce fichier ; le service worker le recharge en priorité réseau, donc les changements
sont visibles immédiatement, **sans toucher à la version du cache**.

### Schéma de `data.json`

```jsonc
{
  "miseAJour": "AAAA-MM-JJ",
  "annonce": {
    "texte": "Texte de la bannière d'annonce (optionnel).",
    "lien": "https://... (lien optionnel)",
    "lienCarte": "https://... (lien optionnel, ex. Google Maps)"
  },
  "cliniques": [
    {
      "id": 1,                       // requis — identifiant unique (nombre)
      "nom": "GMF Exemple",          // requis
      "type": "GMF",                 // requis — GMF, GMF-U, GMF-R, GMF satellite,
                                     //          Clinique, Clinique médicale, CLSC, CH
      "region": "Centre",            // requis — Est | Centre | Ouest
      "rls": "Champlain",            // requis — l'un des 6 RLS (voir le tableau plus haut)
      "lat": 45.50,                  // requis — latitude (nombre)
      "lng": -73.43,                 // requis — longitude (nombre)
      "alias": "",                   // optionnel — mots-clés supplémentaires pour la recherche
      "niveau": "Niveau 12 / 18",    // optionnel
      "adresse": "",                 // optionnel
      "ville": "Brossard",           // optionnel
      "telephone": "",               // optionnel
      "site": "",                    // optionnel
      "personneRessource": "",       // optionnel — courriel de contact
      "dme": "",                     // optionnel — dossier médical électronique
      "porteOuverte": "",            // optionnel — info portes ouvertes
      "bureau": "",                  // optionnel
      "frais": "",                   // optionnel — frais de bureau
      "medecinsRecherches": "",      // optionnel — nombre de médecins recherchés
      "pratiques": ["pec", "gap"],   // optionnel — codes : pec, gap, sad, peri, msk, chir
      "gardes": ["rdv-jour"],        // optionnel — codes : rdv-jour, rdv-soir, rdv-weekend,
                                     //              labo, etablissement, aucune
      "horaire": {                   // optionnel — par jour
        "Lundi": "8h00 – 17h00", "Mardi": "", "Mercredi": "", "Jeudi": "",
        "Vendredi": "", "Samedi": "Fermé", "Dimanche": "Fermé"
      },
      "personnel": {                 // optionnel
        "medecins": "", "residents": "", "specialistes": "", "ipspl": "",
        "infirmieres": "", "infauxiliaires": "", "infsantementale": "",
        "physiotherapeutes": "", "pharmaciennes": "", "nutritionnistes": "",
        "psychologues": "", "travailleuresSociales": "",
        "intervenantspsychosociaux": "", "aac": ""
      },
      "infos": "",                   // optionnel — information publique sur la clinique
      "notes": "",                   // ignoré à l'affichage : les notes sont locales à l'utilisateur
      "photo": "",                   // optionnel
      "posApprox": false             // optionnel — position approximative ?
    }
  ]
}
```

Un champ vide s'affiche comme « À venir ». Les codes de pratique : `pec` (prise en charge),
`gap` (guichet d'accès à la première ligne), `sad` (soins à domicile), `peri` (périnatalité),
`msk` (médecine sportive), `chir` (chirurgie mineure).

`gap` a remplacé l'ancien code `srv` (sans rendez-vous) — ce n'est plus une pratique parmi
d'autres, mais une notion distincte, désormais couverte par le champ `gardes` : `rdv-jour`,
`rdv-soir`, `rdv-weekend`, `labo`, `etablissement`, `aucune`. La section « Gardes et
disponibilités » de la fiche n'apparaît que si ce tableau contient au moins un code.

> **`infos` et `notes` ne sont pas interchangeables.** `notes` alimente le bloc « Mes notes »,
> que l'application écrase avec les notes locales de chaque personne : tout ce qu'on y écrit
> est invisible. L'information publique sur une clinique va dans `infos`.

## Déploiement

Le dépôt est publié via **GitHub Pages**, directement depuis la branche `main`.
Il n'y a ni intégration continue ni étape de compilation : téléverser les fichiers suffit.

Après toute modification du **code** (`index.html`, `sw.js`, icônes…), il faut incrémenter
la version du cache dans `sw.js`, sinon les personnes qui ont déjà ouvert l'application
continueront de voir l'ancienne :

```js
const CACHE = 'ptem-2027-v10';   //  ->  'ptem-2027-v11'
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
