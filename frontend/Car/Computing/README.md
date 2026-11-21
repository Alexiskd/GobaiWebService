# Computing — Iframing et API

Couche d'intégration Gobai Space : page d'embarquement servie dans une iframe, adaptateurs réseau et appels aux API externes. Computing alimente Fairing et les moteurs de Engine sans exposer le rendu.

## Architecture
- `embed/` — point d'entrée `embed.html` : protocole d'embarquement et bridge postMessage pour l'iframe.
- `api/` — les adaptateurs client de l'API (`index.jsx`, `client.jsx`, `scene.jsx`, `tiles.jsx`, `contributions.jsx`, `store.jsx`, `assistant.jsx`), consommés par Fairing et Engine : `get` appelle l'API, avec repli local sur les données embarquées quand elle ne répond pas. Le serveur de l'API n'est pas ici : c'est le backend NestJS (`backend/src`, contrôleurs dans `backend/src/controllers`), seul à servir les routes `/api/v1`.
