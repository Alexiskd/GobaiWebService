# Car — Moteurs Gobai Space

`Car` regroupe les moteurs de calcul, de données et de rendu. L’interface est isolée dans `Fairing`. Les moteurs restent exécutés côté client ; les adaptateurs réseau historiques sont regroupés dans `SystemeEngine/api` et doivent être neutralisés ou remplacés par des données statiques pour une version 100 % statique.

## Architecture
- `SystemeEngine/` — orchestration du système, gestion des ressources, politiques de rendu, catalogue et éphémérides.
- `AstreSolideEngine/` — corps solides et leurs sous-moteurs Map, Relief, Lidar et Atmosphere.
- `AstreGazeuxEngine/` — corps gazeux et leur AtmosphereEngine.
- `StarEngine/` — étoiles, systèmes stellaires et ciel.
- `TextureEngine/` — textures et mosaïques de surface.
- `EruptionEngine/` — surfaces stellaires, volcans et phénomènes éruptifs.
- `shared/` — bibliothèques transverses et internationalisation.
