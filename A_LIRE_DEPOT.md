# Dépôt GitHub — v35 (26 août 2026)

## Ce que contient ce zip

28 fichiers = uniquement ce qui a changé par rapport à ce qui est déjà en ligne sur trouvetaclinique.ca (repo DTMF-Monteregie/Map). Rien d'autre à toucher.

Contenu ajouté : 3 nouveaux RLS de la Montérégie-Ouest — **Vaudreuil-Soulanges** (11 fiches), **Suroît** (6 fiches), **Haut-Saint-Laurent** (4 fiches). 21 nouvelles cliniques au total (61 → 82). Jardins-Roussillon a été revérifié mais n'a subi aucun changement.

## Comment déposer

Chaque fichier de ce zip va au **même chemin relatif** à la racine du repo GitHub (`DTMF-Monteregie/Map`). Écrase les fichiers existants qui portent le même nom — ne renomme rien.

1. **`data.json`** — remplace le fichier à la racine. C'est le seul fichier qui contient les nouvelles données ; tout le reste n'est que du HTML généré à partir de lui.
2. **`sw.js`** — remplace le fichier à la racine. Le numéro de cache est passé à **v35** ; c'est ce qui force les visiteurs déjà venus sur le site à recharger la nouvelle version plutôt que de rester coincés sur l'ancien cache.
3. **`cliniques/index.html`** — remplace le fichier existant (liste générale mise à jour avec les 21 nouvelles cliniques).
4. **`sitemap.xml`** — remplace le fichier à la racine (nouvelles URLs ajoutées).
5. **`rls/vaudreuil-soulanges/index.html`**, **`rls/du-suroit/index.html`**, **`rls/du-haut-saint-laurent/index.html`** — 3 nouveaux dossiers/fichiers, n'existaient pas avant.
6. **Les 21 dossiers sous `cliniques/<slug>/index.html`** — nouveaux, un par clinique ajoutée (Vaudreuil-Soulanges, Suroît, Haut-Saint-Laurent). Liste complète ci-dessous.

## Liste des 21 nouvelles fiches cliniques

- cliniques/gmf-rigaud-centre-de-sante-de-rigaud/
- cliniques/clsc-de-rigaud/
- cliniques/gmf-hudson-hudson-medicentre/
- cliniques/groupe-de-medecine-familiale-sante-ste-angelique/
- cliniques/clsc-de-vaudreuil-dorion-centre-multiservices-de-sante-et-de-services-sociaux-de/
- cliniques/gmf-u-de-vaudreuil-soulanges/
- cliniques/gmf-gmf-r-vaudreuil-dorion-polyclinique-medicale-vaudreuil/
- cliniques/centre-de-sante-medicentre-pincourt-gmf/
- cliniques/centre-medical-des-trois-lacs-gmf-des-trois-lacs/
- cliniques/chsld-et-clsc-de-coteau-du-lac/
- cliniques/clsc-et-groupe-de-medecine-de-famille-universitaire-de-saint-polycarpe/
- cliniques/gmf-du-lac-saint-francois-clinique-medicale-havre-sante/
- cliniques/gmf-salaberry-clinique-medi-val/
- cliniques/clinique-medicale-des-batisseurs-gmf-des-batisseurs/
- cliniques/beauharnois-en-sante-cooperative-de-solidarite/
- cliniques/clsc-de-salaberry-de-valleyfield/
- cliniques/clsc-de-beauharnois/
- cliniques/gmf-du-haut-saint-laurent-centre-medical-huntingdon/
- cliniques/gmf-ormstown-clinique-medicale-ormstown/
- cliniques/clsc-de-huntingdon/
- cliniques/clsc-de-saint-chrysostome/

## Ce qui n'est PAS dans ce zip (et donc rien à faire)

- `index.html`, `monteregie-est/*` — non touchés, aucun des 3 nouveaux RLS n'appartient à l'univers Montérégie-Est.
- Design, filtres, menu, logique de l'app — rien de modifié, tout est généré automatiquement à partir de `data.json`.

## Après le dépôt

GitHub Pages redéploie automatiquement en 1-2 minutes. Vide le cache du navigateur (ou navigation privée) pour vérifier, sinon le v34 en cache peut masquer les changements le temps que le nouveau service worker (v35) prenne le relais.
