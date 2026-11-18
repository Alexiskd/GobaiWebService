# Lot 28 — Bascule A/B classique / atlas

## Objectif

Comparer à chaud le rendu classique de `TileLayer` et le rendu atlas couleur sur les mêmes tuiles, sans reconstruire la scène ni re-télécharger les images.

## Modifications

- `SatelliteTileAtlasPipeline` conserve, pour chaque tuile raccordée, la texture classique originale et son rectangle `baseRect`.
- `setMode('classic')` restaure ces uniforms, mais conserve les références logiques atlas pour permettre un retour immédiat.
- `setMode('atlas')` rebranche les entrées atlas encore disponibles et valide la correspondance texture/UV.
- Les tuiles ajoutées pendant le mode classique sont également préparées dans l'atlas ; elles peuvent être activées sans rechargement.
- `release()` et `dispose()` restaurent d'abord les uniforms classiques, puis relâchent les références atlas.
- `SatelliteSurfaceAtlasDiagnostics.clearFrameSamples()` réinitialise uniquement la fenêtre de mesures, sans effacer les compteurs d'attaches.
- `SolarEngine` expose `setSurfaceAtlasMode`, `resetSurfaceAtlasBenchmark` et `getSurfaceAtlasComparison`.
- Les échantillons de frame sont étiquetés `classic-reference`, `atlas-active` ou `mixed-scene-atlas-experimental`.

## API d'expérimentation

```js
// Basculer tous les corps raccordés vers le rendu classique.
solarEngine.setSurfaceAtlasMode('classic');

// Basculer tous les corps raccordés vers l'atlas.
solarEngine.setSurfaceAtlasMode('atlas');

// Basculer un seul corps (les mesures deviennent globales/mixed si l'autre reste différent).
solarEngine.setSurfaceAtlasMode('classic', 'earth');

// Effacer la fenêtre de mesures avant une séquence A/B.
solarEngine.resetSurfaceAtlasBenchmark();

// Lire la comparaison des fenêtres enregistrées.
solarEngine.getSurfaceAtlasComparison();
```

## Protocole A/B manuel

1. Ouvrir la même scène et attendre que les tuiles Terre/Lune soient stables.
2. Appeler `resetSurfaceAtlasBenchmark()`.
3. Appeler `setSurfaceAtlasMode('classic')`, attendre la stabilisation, puis laisser tourner au moins 10 à 20 secondes.
4. Appeler `setSurfaceAtlasMode('atlas')`, attendre la stabilisation, puis laisser tourner la même durée.
5. Lire `getSurfaceAtlasComparison()` ou `getCoreDiagnostics().surfaceAtlasComparison`.
6. Refaire la séquence plusieurs fois, dans l'ordre inverse également, pour réduire le biais lié au démarrage et à la chauffe.
7. Capturer manuellement les mêmes vues/cadrages en mode classique et atlas pour contrôler coutures, orientation UV et mipmaps.

## Interprétation et limites

- `PerfProbe` et `renderer.info` mesurent toujours la scène entière. Les différences A/B ne sont donc pas attribuables exclusivement à la Terre ou à la Lune.
- Le mode classique restaure l'affichage d'origine, mais garde volontairement les pages atlas retenues en mémoire pour permettre le retour instantané. Le nombre de textures GPU n'est donc pas une comparaison mémoire « à froid ».
- Pour mesurer la mémoire réellement libérée, il faut comparer deux sessions séparées (ou redémarrer le moteur entre les configurations), pas seulement basculer le mode à chaud.
- Les captures d'écran ne sont pas générées automatiquement ; le contrôle visuel reste manuel.
- Le pipeline concerne toujours uniquement la couche couleur. Altitude, normales et lumières nocturnes conservent leurs chargeurs existants.
- Ce lot ne revendique aucun gain de FPS, de draw calls ou de mémoire avant mesure dans un navigateur réel.
