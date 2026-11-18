# Optimisation du stockage Gobai

- Les médias image de la galerie (fichiers et vignettes) sont convertis en WebP, dimensions conservées.
- Le manifeste `backend/data/galerie/manifest.json` est mis à jour avec les chemins, MIME, tailles et empreintes SHA-256.
- La vidéo Artemis II est ré-encodée en H.264/AAC à résolution identique avec `faststart`.
- Les fichiers image sources remplacés ont été retirés du dossier afin d’éviter les doublons.
- Les données géographiques, textures du moteur, fixtures de tests, code source et fichiers de dépendances sont conservés.

Les médias restent servis par les routes de galerie existantes ; le type MIME provient du manifeste.
- Les 14 captures et illustrations JPG de la documentation (`docs/`) sont converties en WebP qualité 84 ; les références dans les fichiers texte sont mises à jour.


## V5 — recompression WebP
- Réencodage des images WebP lorsque le nouveau fichier est plus léger (qualité 75, méthode 6), sans changer les dimensions ni les chemins.
- Mise à jour des tailles et empreintes SHA-256 des images de la galerie dans le manifeste.
- Les fichiers qui auraient grossi ont été conservés tels quels.


## Modèles GLB Mars et Mercure
- Ajout de `frontend/public/models/planets/mars.glb` et `mercury.glb`.
- Textures embarquées dans les GLB ; modèles procéduraux de visualisation, rayon normalisé 1 unité.
- Le moteur conserve son rendu tuilé actuel ; ces modèles sont disponibles comme assets statiques facultatifs.
