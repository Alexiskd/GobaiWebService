# Computing — Iframing et API

Couche d'intégration Gobai Space : page d'embarquement servie dans une iframe, adaptateurs réseau et appels aux API externes. Computing alimente Fairing et les moteurs de Engine sans exposer le rendu.

## Architecture
- `embed/` — point d'entrée `embed.html` : protocole d'embarquement et bridge postMessage pour l'iframe.
- `api/` — l'API du frontend, traduite en NestJS. Le serveur démarre par `main.ts` (`npm install`, puis `npm start` dans `api/`) ; les modules domaine (`scene/`, `tiles/`, `donations/`, `contributions/`) portent les contrôleurs et services des routes. Les modules client (`index.jsx`, `client.jsx`, `scene.jsx`, `tiles.jsx`, `contributions.jsx`) restent les adaptateurs consommés par Fairing et Engine : `get` appelle l'API NestJS, avec repli local sur les données embarquées quand elle ne répond pas.
