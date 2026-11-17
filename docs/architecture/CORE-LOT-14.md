# Core — Lot 14 : géométrie unitaire partagée des satellites

## Décision technique

Les sphères de fond des satellites ne sont pas converties directement en `InstancedMesh` dans ce lot. Chaque satellite cartographié possède un `TileManager` avec son propre matériau, ses uniforms, son état de couverture et son facteur de sphère de fond. Regrouper ces surfaces dans un seul `InstancedMesh` imposerait de refondre le shader pour transporter ces états par instance ; le faire maintenant risquerait de casser les cartes et les transitions de fond.

Le lot applique donc une optimisation sûre : toutes les sphères satellites de topologie identique réutilisent une géométrie unitaire `SphereGeometry(1, 64, 48)`. Le rayon physique est porté par `Mesh.scale`, tandis que chaque satellite conserve son mesh, son matériau et son `TileManager` indépendants.

## Fichiers modifiés

- `frontend/src/moteur/engine/satellites.jsx`
  - Acquisition d'une géométrie unitaire partagée via `SharedResourcePool` et `acquireUnitSphereGeometry`.
  - Échelle individuelle par rayon moyen du satellite.
  - Libération unique de la géométrie après le retrait des satellites.
- `frontend/src/moteur/engine/tiles/tileManager.jsx`
  - `placeBackdrop()` ajuste désormais l'échelle du mesh plutôt que de modifier le buffer de géométrie.
  - Préserve les échelles de rayon et l'aplatissement existant des géantes gazeuses.
- `frontend/src/moteur/engine/tiles/backdropMeshScale.js`
  - Helper validant les facteurs et appliquant le ratio d'échelle sans mutation de géométrie partagée.
- Tests `.test.js` pour la mise à l'échelle et le partage de géométrie.

## Garanties

- Les meshes satellites restent distincts : sélection, visibilité, LOD, orientation synchrone et cartes restent indépendants.
- Les matériaux et uniforms propres à chaque astre ne sont pas fusionnés.
- Le facteur de fond est réversible et ne modifie plus la géométrie commune.
- La géométrie est libérée par le pool après usage.

## Limites

Ce lot réduit les duplications de buffers géométriques CPU/GPU, mais ne réduit pas les draw calls : chaque satellite garde son mesh et son matériau. L'instancing effectif nécessitera un shader de surface capable de gérer les uniforms et états de tuiles par instance, ou une stratégie de batch par compatibilité stricte.
