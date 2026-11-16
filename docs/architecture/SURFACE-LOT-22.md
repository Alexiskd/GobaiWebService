# Lot 22 — Éviction sûre des pages atlas GPU

## Objectif

Permettre de récupérer réellement les textures GPU des pages atlas devenues inutilisées, sans détruire une page encore référencée par une tuile.

## Changements

- `SatelliteMultiLayerTextureAtlasManager.evictIdlePages()` évince les pages dont le compteur de références est nul.
- Toutes les entrées appartenant à une page évincée sont invalidées avant destruction de ses textures.
- Les textures de chaque canal sont détruites via `texture.dispose()` et le callback de page éventuel.
- Les indices de pages libérés sont réutilisables ; les indices des pages encore vivantes restent stables.
- À saturation de `maxPages`, le gestionnaire tente automatiquement d'évincer une page inactive avant de refuser une nouvelle allocation.
- `getPageCount()` et `getMemoryStats()` comptent les pages réellement vivantes, pas les trous dans le tableau interne.

## Contrat de sécurité

Chaque tuile ou matériau qui conserve une texture d'atlas doit appeler `retain(id)` et appeler `release(id)` uniquement après avoir cessé de référencer cette texture. Une page dont le compteur de références est supérieur à zéro ne peut pas être évincée. Quand une page est détruite, toutes ses entrées sont invalidées ; les consommateurs doivent donc traiter une entrée absente comme un cache miss et recharger la source.

L'éviction est explicite et peut aussi être déclenchée automatiquement lorsque le budget `maxPages` est atteint. Elle ne modifie pas les matériaux Three.js à la place des consommateurs : le protocole retain/release constitue la garantie de non-destruction prématurée.

## Limites

- L'estimation mémoire reste une estimation RGBA8, pas une mesure GPU du navigateur.
- Le pipeline TileLayer garde le chargement classique comme repli ; il doit appeler `release` au moment où le matériau cesse effectivement d'utiliser la page.
- Pas de compactage des slots à l'intérieur d'une page vivante.
- Pas de validation visuelle WebGL ni de mesure de mémoire réelle dans ce lot.

## Validation

Tests Node sans DOM/WebGL : éviction des pages inactives, protection des pages retenues, destruction des textures multi-couches, réutilisation d'index, éviction automatique à saturation et cohérence des compteurs.
