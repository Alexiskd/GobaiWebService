# Modèles GLB de Mars et Mercure

Deux modèles procéduraux optimisés, intégrés comme ressources statiques facultatives.

- `mars.glb` : surface ocre, régions sombres, calottes polaires stylisées et cratères.
- `mercury.glb` : surface gris-beige, champ de cratères dense, bassin et rayons d'éjectas stylisés.
- Texture JPEG 2048 × 1024 intégrée dans chaque GLB ; aucun fichier externe requis au chargement.
- Sphère UV 256 × 128, environ 33 000 sommets et 65 000 triangles. Rayon normalisé à 1 unité.

**Important :** relief et détails sont procéduraux et illustratifs, pas des données topographiques mesurées. Adapter l'échelle avant placement dans le moteur. Le rendu tuilé existant de Mars et Mercure n'est pas remplacé.


## Relief numérique de Mars (pipeline MOLA)

Le moteur possède désormais un chemin séparé pour les altitudes martiennes : `GET /api/v1/tiles/mars-relief/{z}/{x}/{y}.png`. Il demande des pixels `F32` au service DEM MOLA, puis encode les mètres signés au format Terrarium pour le shader du globe. Le service ne lit jamais la couleur de la couche MOLA hillshade comme une altitude.

- Source principale configurable par `MARS_RELIEF_IMAGESERVER_URL` (par défaut : DEM numérique HRSC-MOLA/USGS).
- Source de secours configurable par `MARS_RELIEF_FALLBACK_IMAGESERVER_URL` (par défaut : DEM MOLA global de NASA Mars Trek).
- Référence verticale : aréoïde martien ; altitudes signées (bassins négatifs, hauts plateaux et volcans positifs).
- Projection des requêtes : Mars Equidistant Cylindrical / MarsEC0, rayon de référence 3 396 190 m, longitude Est positive.
- Cache mémoire puis table PostgreSQL `mars_relief_tiles`.
- Modèle GLB calculé à la demande : `/api/v1/tiles/mars-relief/model.glb?cols=720&exaggeration=1`.

La carte colorisée MOLA de Mars Trek (463 m/px) est un hillshade colorisé : elle sert à visualiser les reliefs, pas à retrouver des altitudes pixel par pixel. Le pipeline de volume utilise le DEM numérique MOLA/HRSC-MOLA. Le relief du GLB fourni dans ce ZIP reste procédural tant que le premier téléchargement du DEM n'a pas été exécuté avec un backend ayant accès à la source.
