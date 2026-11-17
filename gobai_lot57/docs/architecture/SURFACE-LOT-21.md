# Lot 21 — Références et comptabilité mémoire de l’atlas

## Objectif

Sécuriser le cycle de vie logique des entrées d’atlas multi-couches et fournir une estimation reproductible de la mémoire des pages.

## Changements

- `SatelliteMultiLayerTextureAtlasManager.retain(id)` incrémente le nombre de références d’une entrée et de sa page.
- `release(id)` décrémente une référence et ne retire l’entrée qu’à la dernière libération.
- `getMemoryStats()` expose pages, canaux, entrées vivantes, références, slots et estimation mémoire RGBA8.
- `SatelliteTileAtlasPipeline` retient l’entrée lorsqu’une tuile est raccordée et la libère lors de son détachement.
- `dispose()` détruit les textures des pages et remet à zéro les compteurs.

## Garanties et limites

Les pages restent allouées jusqu’à `dispose()`. Les slots ne sont pas recyclés et aucune éviction GPU de page n’est réalisée : c’est volontaire, car plusieurs matériaux peuvent encore référencer une page partagée. La mémoire affichée est une estimation RGBA8 (`pageSize × pageSize × 4 × nombre de canaux × nombre de pages`), sans tenir compte précisément des mipmaps, du format réel, de l’alignement ou du pilote graphique. Elle ne constitue pas une mesure GPU.

Le lot ne prétend donc pas réduire la mémoire GPU ; il rend le cycle de vie explicite et mesurable avant d’implémenter une éviction sûre avec remplacement des textures dans tous les matériaux concernés.

## Validation

Tests Node sans DOM ni WebGL : références multiples, libération finale, persistance de la page, compteurs et estimation mémoire.
