# Gobai Space — Surface Lot 24 : pont Atlas / GPU Memory Budget

## Objectif

Relier les pages du `SatelliteMultiLayerTextureAtlasManager` au `SatelliteGpuMemoryBudgetManager` afin que les allocations de pages soient comptabilisées, épinglées lorsqu'une tuile les utilise et évincées via une opération ciblée et sûre.

## Nouveaux éléments

- `SatelliteAtlasGpuBudgetBridge.js` : inscrit chaque page d'atlas dans le budget, calcule une estimation RGBA8, synchronise les références, épingle/désépingle les pages et délègue l'éviction à `atlas.evictPage(index, expectedPage)`.
- `SatelliteAtlasGpuBudgetBridge.test.js` : tests d'inscription, de protection des pages utilisées, d'éviction par budget et d'isolation par astre.
- `SatelliteMultiLayerTextureAtlasManager.getPageInfo()` : expose les informations nécessaires à l'adaptateur sans dépendre d'un rendu WebGL.
- `SatelliteMultiLayerTextureAtlasManager.evictPage()` : éviction ciblée, refusée si la page possède encore des références.
- `SatelliteTileAtlasPipeline` accepte maintenant `memoryBudgetBridge` et `bodyId`. Le pont reste optionnel ; le chemin classique reste inchangé sans ce paramètre.

## Règle d'isolation par astre

Une page d'atlas appartient à un seul `bodyId`. L'allocateur ne mélange donc pas les tuiles de plusieurs astres dans une même page. Cette contrainte permet d'attribuer la mémoire au bon budget et d'appliquer les états `ACTIVE`, `BACKGROUND` et `UNLOADED`.

Pour utiliser le pont, fournir `bodyId` lors de `enqueue()` ou lors de `SatelliteTileAtlasPipeline.attach()`. Une page sans propriétaire ne peut pas être inscrite dans un budget par astre.

## Cycle de vie

1. Le pipeline crée une entrée atlas.
2. `retainEntry(id)` retient l'entrée et synchronise l'inscription de sa page.
3. Une page avec références est épinglée dans le gestionnaire GPU.
4. `releaseEntry(id)` libère la référence puis désépingle la page si aucune tuile ne la référence.
5. Si le budget est dépassé, le gestionnaire appelle l'éviction ciblée ; l'atlas vérifie une seconde fois l'absence de références avant de détruire les textures.
6. `sync()` réconcilie les pages supprimées directement par le plafond interne de l'atlas.

## Estimation mémoire

Par défaut : `pageSize × pageSize × 4 octets × nombre de canaux`. Pour une page 2048² et quatre canaux RGBA8, cela représente 64 Mio, hors mipmaps, alignements et allocations internes du pilote. Le calcul reste une estimation, pas une mesure GPU réelle.

Un callback `bytesPerPage(info)` permet de remplacer cette estimation si les formats ou profondeurs de texture diffèrent.

## Limites

- Le pont n'est pas encore créé automatiquement par `SolarEngine` : il doit être instancié et injecté dans le pipeline.
- Le `bodyId` doit être transmis par l'appelant ; aucune déduction automatique à partir du nom de tuile n'est faite.
- Les pages restent comptées en RGBA8 par défaut, même si un canal utilise un autre format.
- Aucune mesure de VRAM réelle ni validation navigateur/WebGL n'a été effectuée.
- L'isolation par astre peut créer davantage de pages partiellement remplies ; c'est un compromis assumé pour garantir une attribution mémoire fiable.

## Validation

Les tests Node couvrent l'inscription, le comptage, le pin/unpin, la protection des pages référencées, l'éviction ciblée, la priorité d'état et l'intégration au pipeline opt-in. Le rendu GPU réel et le build Vite restent à valider dans l'environnement du projet avec ses dépendances installées.
