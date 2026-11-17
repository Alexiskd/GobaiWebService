# Gobai Space — Lot 27 : validation structurelle et diagnostics de surface atlas

## Objectif

Ajouter une instrumentation vérifiable au pipeline expérimental Terre/Lune avant de conclure à un gain visuel ou de performance. Le lot mesure les attaches, replis, concordances d'UV et métriques de rendu déjà fournies par `PerfProbe`.

## Modules

- `frontend/src/moteur/core/SatelliteSurfaceAtlasDiagnostics.js`
  - `validateSatelliteAtlasTileBinding(entry, uniforms)` vérifie que l'entrée est prête, que `uniforms.map` référence la texture couleur de l'atlas, que `baseRect` correspond au rectangle UV et que celui-ci reste dans `[0, 1]`.
  - `SatelliteSurfaceAtlasDiagnostics` comptabilise les attaches, replis, libérations et validations par astre.
  - Les échantillons `PerfProbe` (`cpuMs`, `gpuMs`, appels, triangles, textures, géométries) sont conservés dans une fenêtre bornée.
  - `compareModes()` permet de comparer deux séries seulement si un appelant les a explicitement étiquetées avec deux modes distincts.
- `SatelliteTileAtlasPipeline.js` transmet les résultats d'attache et de libération à l'instrumentation et vérifie la liaison après le binding.
- `engine.jsx` partage une instance de diagnostics entre les pipelines Terre/Lune et y enregistre les mesures de scène publiées par `PerfProbe`.
- `getCoreDiagnostics()` expose `surfaceAtlasValidation`.

## Ce que les mesures permettent

- Détecter un uniforme `map` qui ne référence pas la texture atlas attendue.
- Détecter un rectangle UV incohérent ou hors des limites de la page.
- Quantifier les attaches réussies et les replis par cause et par astre.
- Consulter les métriques globales de scène et comparer des séries étiquetées explicitement.

## Limites et interprétation

- Cette validation est structurelle : elle ne compare pas les pixels rendus, les coutures visibles, le filtrage réel ou les couleurs à l'écran.
- Les mesures `PerfProbe` et `renderer.info` concernent la scène entière ; elles ne peuvent pas être attribuées exclusivement à la Terre ou à la Lune.
- Le moteur ne bascule pas automatiquement entre un rendu classique et un rendu atlas. Il n'existe donc pas encore de benchmark A/B automatique.
- `gpuMs` reste `null` si le navigateur ne fournit pas l'extension de chronométrage GPU.
- Les compteurs `renderer.info.memory.textures` et les octets estimés des atlas ne sont pas une mesure directe de la mémoire physique GPU.
- Le rendu WebGL doit encore être contrôlé dans un navigateur avec des vues rapprochées, des transitions de zoom et des captures comparatives.

## Validation exécutée

Les tests Node couvrent les contrôles UV, la référence de texture, les compteurs, les replis, les fenêtres bornées et les comparaisons de séries. Ils ne remplacent pas un test visuel navigateur.
