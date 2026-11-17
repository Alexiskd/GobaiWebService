# Lot 9 — mutualisation explicite des matériaux

## Changement

`SharedResourcePool` fournit un pool générique à références comptées. Une clé représente une configuration strictement identique et explicite ; le pool ne tente pas de comparer automatiquement des matériaux arbitraires.

`SatelliteSystem` utilise ce pool pour ses `MeshLambertMaterial` de sphères. Les satellites de même couleur partagent désormais un matériau au lieu d'en créer un chacun. Les géométries sphériques restent individuelles car leur rayon varie selon le satellite.

## Cycle de vie

- Chaque satellite acquiert une référence au matériau associé à sa couleur normalisée.
- `SatelliteSystem.dispose()` libère une référence par satellite.
- Le matériau n'est détruit qu'à la dernière libération.
- Les orbites et géométries individuelles gardent leur cycle de vie actuel.

## Limites

Le lot ne fusionne pas les meshes et ne promet donc pas une baisse du nombre de draw calls. Il réduit les allocations de matériaux dupliqués et centralise leur cycle de vie. Les matériaux avec uniforms, textures ou états spécifiques ne sont pas mutualisés.

## Validation

Tests unitaires du pool : création unique par clé, références, libération finale, isolation des clés et validation des entrées. Build Vite complet à effectuer dans un environnement avec les dépendances installées.
