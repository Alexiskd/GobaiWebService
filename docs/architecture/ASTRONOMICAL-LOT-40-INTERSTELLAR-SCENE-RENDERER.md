# Lot 40 — Interstellar Scene Renderer

## But

Placer un système stellaire distant dans le repère global Gobai à partir de coordonnées ICRS et d'une distance mesurée. Le système planétaire conserve son repère orbital local et est placé comme enfant du groupe stellaire global.

## Transformation

1. RA/Dec ICRS + distance (parallaxe positive ou distance propagée) -> vecteur cartésien héliocentrique en parsecs.
2. Repère ICRS `(x,y,z)` -> axes scène Gobai `(x,z,-y)`.
3. Multiplication par `parsecToSceneUnits` et ajout de `origin`.

Valeur par défaut : 100 unités de scène par parsec. Cette valeur est une échelle de navigation configurable, pas une échelle physique certifiée de la scène existante. Il faut confirmer l'orientation et la position de l'origine solaire par rapport au repère de caméra avant de l'utiliser en production.

## API

- `icrsToHeliocentricParsecs()`
- `icrsParsecsToScene()`
- `buildInterstellarSystemModel()`
- `createInterstellarSystemGroup()`
- `InterstellarSceneRenderer.addSystem() / focusSystem() / removeSystem()`

## Limites

- Sans parallaxe positive ou distance propagée, le système est signalé `position-unavailable` et n'est pas placé arbitrairement.
- Le changement d'axes ne constitue pas une transformation ICRS vers ICRF/J2000, galactique ou une orientation caméra calibrée ; le repère reste explicitement ICRS.
- La navigation est exposée par contrôleur, mais le raccordement automatique à l'interface de navigation principale doit être fait par le composant appelant.

## Exemple d'intégration statique

```js
import * as THREE from 'three';
import { createAstronomicalCatalogService, createAstronomicalSystemExplorer,
  createInterstellarSceneRenderer } from './moteur/data/astronomy/index.js';

const explorer = createAstronomicalSystemExplorer({ catalogService: createAstronomicalCatalogService() });
const result = await explorer.resolveByName('Proxima Centauri', {
  targetEpochJulianYear: 2026,
  includeExoplanets: true,
});
const proxima = result.systems.find((item) => /proxima/i.test(item.star?.name || ''));
if (!proxima) throw new Error('Aucun système Proxima exploitable dans les résultats du catalogue.');
const renderer = createInterstellarSceneRenderer({ THREE, scene, camera, controls,
  origin: { x: 0, y: 0, z: 0 }, parsecToSceneUnits: 100 });
const entry = renderer.addSystem(proxima, { targetJulianDate: 2461350.5 });
renderer.focusSystem(entry.model.sourceSystemId);
```

Les identifiants Gaia doivent être disponibles pour un rattachement automatique strict des planètes à leur hôte. Si le fournisseur ne fournit pas de distance, aucun placement global n'est inventé.
