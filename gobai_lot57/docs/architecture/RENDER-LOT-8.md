# Lot 8 — Diagnostics du pipeline de rendu Three.js

## Objectif

Mesurer les coûts structurels déjà exposés par `PerfProbe` et `renderer.info`, puis fournir des signaux exploitables pour une optimisation ultérieure.

## Ajouts

- `RenderDiagnosticsPolicy.js` classe les appels de dessin, triangles, textures et géométries en niveaux `normal`, `warning`, `critical` ou `unknown`.
- `SolarEngine` actualise ces diagnostics au rythme de publication de `PerfProbe` (environ deux fois par seconde).
- `getCoreDiagnostics()` expose le résultat dans `renderPipeline`.
- Les recommandations ciblent le bon levier : mutualisation des matériaux/appels, LOD géométrique, audit des textures et géométries.

## Limites volontaires

Ce lot est observabilité seulement. Il ne remplace pas les matériaux, ne fusionne pas les géométries, ne change pas les shaders, ne modifie pas les ombres et ne détruit aucune ressource. Ces transformations nécessitent une cartographie des propriétaires et des dépendances de chaque objet Three.js afin de ne pas casser les moteurs spécialisés.

Les seuils par défaut sont des seuils d'alerte configurables, pas des limites universelles de WebGL. Les compteurs `renderer.info` reflètent les ressources et opérations comptabilisées par Three.js, pas une mesure directe de VRAM physique.
