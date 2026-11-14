# Fichiers de dépôts tiers importés dans le projet

Ces fichiers étaient téléchargés en direct (jsDelivr) par le backend. Ils sont maintenant dans le projet et lus sur
le disque du serveur : l'application ne dépend plus de ces dépôts pour fonctionner.

| Dossier | Dépôt d'origine | Version | Fichiers | Utilisé par |
| --- | --- | --- | --- | --- |
| `world-atlas/` | https://github.com/topojson/world-atlas | 2.0.2 | dépôt complet (README, LICENSE, package.json, prepublish) + `countries-50m.json` | pays en TopoJSON (`world-atlas.service.ts`), frontières et milieux des pays (`borders.service.ts`) |
| `natural-earth/` | https://github.com/nvkelso/natural-earth-vector | 5.1.2 (villes), 4.1.0 (pays) | `ne_10m_populated_places.geojson`, `ne_50m_admin_0_countries-v4.1.0.geojson`, LICENSE.md, VERSION | villes (`city-labels.service.ts`) ; source de `countries-50m.json` |
| `three.js/` | https://github.com/mrdoob/three.js | r180 | `moon_1024.jpg`, LICENSE | texture de secours de la Lune (`moon-color.service.ts`) |

Le script `world-atlas/prepublish` porte des commentaires en français ajoutés dans ce projet ; ses commandes sont celles du dépôt d'origine.

## countries-50m.json

Le dépôt GitHub de World Atlas ne contient pas ce fichier : il est fabriqué à la publication du paquet npm, à partir
de Natural Earth. Il est refabriqué ici avec la même recette (script `prepublish`) par le backend
(`backend/src/services/world-atlas/countries-topology.ts`), à partir des pays Natural Earth 4.1.0 (la version utilisée
par world-atlas 2.0.2) :

    npm run world-atlas:build --prefix backend

Différences avec le fichier du paquet npm : pas d'objet `land`, pas de recollage à l'antiméridien (le backend retire
lui-même les découpes à ±180°).

## Dépôts non copiés en entier

Natural Earth et three.js, très volumineux, ne sont pas copiés en entier : seuls les fichiers
utilisés par l'application le sont. La bibliothèque three.js elle-même est une dépendance npm du frontend, déjà
incluse dans le site à la compilation.

## ne_10m_populated_places.geojson (allégé)

Le fichier des villes de Natural Earth 5.1.2 porte 137 propriétés par ville ; `city-labels.service.ts` n'en lit que 23
(nom, nom français, pays, région, fuseau horaire, population, surface, capitale, nom dans 13 écritures). Le fichier du
projet ne garde que celles-là : mêmes 7 342 villes, mêmes positions, mêmes valeurs, dans le même ordre
(19,4 Mo → 4,9 Mo). Pour le refabriquer à partir du fichier d'origine :

    node backend/tools/natural-earth/alleger-villes.mjs <fichier d'origine>

Une propriété de plus à lire dans le service doit d'abord être ajoutée à la liste `KEPT` de ce script.
