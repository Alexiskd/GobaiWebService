# Lot 26 — Raccordement expérimental des atlas à TileLayer

## Portée

Le pipeline atlas couleur est maintenant instancié par `SolarEngine` pour la Terre et la Lune. Le calcul des UV corrige aussi la conversion des coordonnées Canvas (origine haut-gauche) vers les UV WebGL (v=1 au nord), en cohérence avec `tileGeometry.jsx` et `flipY=true`. Chaque astre dispose de son propre `SatelliteMultiLayerTextureAtlasManager` (canal `color` uniquement), de son `SatelliteAtlasGpuBudgetBridge` et de son `SatelliteTileAtlasPipeline`. `TileManager` transmet le pipeline et `bodyId` à `TileLayer`; les tuiles installées peuvent ainsi remplacer leur uniform `map` et `baseRect` par la page atlas.

## Sécurité / repli

- L'activation est limitée à `earth` et `moon`.
- Si Canvas, atlas ou budget ne peuvent pas être initialisés, le chargement historique reste actif.
- L'altitude, les normales, les lumières nocturnes et les overlays ne sont pas migrés.
- Les textures source historiques restent libérées par le cycle de vie normal de `TileLayer`.
- Les tuiles libèrent leur référence atlas avant la destruction des pages.
- Les atlas sont détruits après les `TileManager`, avant le budget central.

## Mémoire

Une page 2048² RGBA8 représente 16 Mio sans mipmaps. Comme le canal couleur active une chaîne mipmap complète, le pont budgète environ 21,33 Mio par page (facteur 4/3). Il s’agit d’une estimation, pas d’une mesure GPU réelle. Le maximum local est de quatre pages par astre; le budget central peut évincer les pages inactives.

## Diagnostics

`SolarEngine.getCoreDiagnostics().surfaceAtlas` expose, par astre, le nombre de pages, les entrées, les références, l'estimation mémoire et les statistiques du bridge.

## Validation à effectuer dans le navigateur

Le pipeline est désormais instancié automatiquement sur Terre et Lune, mais le build Vite, le rendu visuel, l'orientation UV, le comportement mipmap et les gains de mémoire/performance doivent encore être mesurés dans un navigateur WebGL réel. Le fallback classique doit être comparé avant activation de tout autre canal.
