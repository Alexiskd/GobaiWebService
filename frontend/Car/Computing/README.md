# Computing — Iframing et API

Couche d'intégration Gobai Space : page d'embarquement servie dans une iframe, adaptateurs réseau et appels aux API externes. Computing alimente Fairing et les moteurs de Engine sans exposer le rendu.

## Architecture
- `embed/` — point d'entrée `embed.html` : protocole d'embarquement et bridge postMessage pour l'iframe.
- `api/` — adaptateurs réseau (tuiles, scène, éphémérides, contributions) et résolution des URL externes.
