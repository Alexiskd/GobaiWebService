# Engine — Moteurs Gobai Space

`Engine` regroupe les moteurs de calcul, de données et de rendu de la modélisation 3D. L'interface est isolée dans `Fairing`, les appels réseau dans `Computing` et la mise en base de données dans `Transmission`. Les moteurs restent exécutés côté client.

## Architecture
- `SystemeEngine/` — orchestration du système, gestion des ressources, politiques de rendu, catalogue et éphémérides.
- `AstreSolideEngine/` — corps solides et leurs sous-moteurs Map, Relief, nuages de points (contributions) et Atmosphere.
- `AstreGazeuxEngine/` — corps gazeux et leur AtmosphereEngine.
- `StarEngine/` — étoiles, systèmes stellaires et ciel.
- `TextureEngine/` — textures et mosaïques de surface.
- `EruptionEngine/` — surfaces stellaires, volcans et phénomènes éruptifs.
- `shared/` — bibliothèques transverses et internationalisation.
