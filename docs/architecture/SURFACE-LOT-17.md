# Lot 17 — Atlas multi-astre progressif

## Objectif

Fournir un gestionnaire d'atlas couleur commun aux prototypes de surface instanciée des lots 15 et 16, sans remplacer `TileLayer`, `TileManager` ni les shaders cartographiques existants.

## Modules

- `SatelliteAtlasPageAllocator` : allocation déterministe par rangées, rectangles utiles UV normalisés, gutter et réduction proportionnelle des images trop grandes.
- `SatelliteTextureAtlasManager` : pages injectées, file priorisée, budget de traitement par appel, plafond de pages, accès aux rectangles UV, libération logique et destruction des textures.
- `createCanvasSatelliteAtlasPage` : fabrique navigateur optionnelle basée sur `THREE.CanvasTexture`.
- `blitSatelliteAtlasImage` : copie une image et étend ses bords dans le gutter pour limiter les contaminations entre régions lors du filtrage/mipmapping.

## Contrat d'intégration

Le gestionnaire attend `createPage({ pageSize, index })` et `blit(page, source, allocation)`. Cela permet de tester le placement sans DOM/WebGL et de brancher ultérieurement d'autres sources (bitmap, canvas ou pipeline de décodage).

`entry.uv` est un `Float32Array([u, v, largeur, hauteur])` prêt pour `writeSatelliteAtlasRect()` du lot 16. Chaque entrée conserve la référence de sa page/texture.

## Limites connues

- Atlas couleur uniquement : relief, normal maps, lumières nocturnes, couches et états LOD ne sont pas encore regroupés.
- Allocateur shelf sans réutilisation des trous : `release()` retire la référence logique mais ne recycle pas le rectangle. Cela évite d'écraser une région encore utilisée par une instance GPU. Une future compaction devra reconstruire la page et réécrire tous les rectangles UV concernés.
- Le plafond de pages laisse les éléments non chargés dans la file ; le demandeur peut relancer `processQueue()` après libération ou augmentation de capacité.
- Le shader du lot 16 n'est pas branché au rendu de production. Aucun gain de draw calls ou équivalence visuelle n'est revendiqué.

## Validation

Les tests couvrent le placement UV, les gutters, la réduction des sources trop grandes, la priorité et le budget de chargement, le plafond de pages, la libération et le cycle de vie.
