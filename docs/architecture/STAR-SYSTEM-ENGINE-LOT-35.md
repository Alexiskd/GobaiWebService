# Lot 35 — Star System Engine Integration

## Objectif

Assembler les enregistrements Gaia DR3, SIMBAD et NASA Exoplanet Archive dans un modèle de système stellaire exploitable par les moteurs de rendu Gobai Space, sans confondre rapprochement probable et identité vérifiée.

## Nouveau module

`frontend/src/moteur/engine/star/StarSystemEngine.js`

Exports :

- `buildStarSystems(records, options)` : assemblage déterministe et sans accès réseau.
- `StarSystemEngine` : façade sur `AstronomicalCatalogService`.
- `createStarSystemEngine(options)` : factory.

## Règles d'identité et de rattachement

1. Deux enregistrements stellaires ne sont réunis automatiquement que si leur identifiant Gaia DR3 est strictement identique.
2. Une proximité de coordonnées ICRS reste un candidat de revue ; elle ne fusionne pas les étoiles.
3. Une exoplanète est attachée automatiquement à son étoile uniquement si `host.gaiaDr3Id` correspond à un identifiant Gaia présent.
4. Une correspondance par nom d'hôte reste dans `candidatePlanetHosts` et n'est jamais attachée automatiquement.
5. Les enregistrements et leur provenance sont conservés dans le système résultant.

## Propagation astrométrique

Si `targetEpochJulianYear` est fourni et que l'enregistrement Gaia possède une époque, des coordonnées et des données astrométriques, le moteur utilise `propagateAstrometricRecord` du lot 33. L'époque cible est une année julienne décimale, pas une date JD.

## Orbites d'exoplanètes

Si `targetJulianDate` est fourni, le moteur appelle le lot 34 pour chaque planète rattachée. Les phases orbitales manquantes ne sont pas inventées : l'état devient `unavailable` avec le motif d'indisponibilité. Les paramètres de phase validés peuvent être fournis dans `orbitOverridesByPlanetId`.

## Exemple

```js
import { createAstronomicalCatalogService } from './data/astronomy/index.js';
import { createStarSystemEngine } from './engine/star/StarSystemEngine.js';

const catalogService = createAstronomicalCatalogService();
const starEngine = createStarSystemEngine({ catalogService });
const systems = await starEngine.resolveByName('Proxima Centauri', {
  targetEpochJulianYear: 2026.0,
  targetJulianDate: 2461350.5,
});
```

Les appels réseau utilisent les endpoints TAP déjà définis dans le lot 31. Les contraintes CORS, disponibilité des fournisseurs, limites TAP et besoins éventuels d'un proxy restent applicables.

## Limites

- Ce lot ne crée pas de coordonnées mondiales 3D pour le rendu : il conserve ICRS et les positions orbitales relatives à l'étoile.
- Il ne transforme pas les repères ICRS/galactiques/orbitaux vers le repère Three.js de la scène.
- Les rapprochements SIMBAD/Gaia fondés uniquement sur les coordonnées demandent toujours une validation externe.
- Les phases et époques NASA restent conditionnées par leur disponibilité et leurs conventions temporelles.
- Pas de dynamique N-corps, perturbations, précession, incertitudes ou propagation de covariance.
- Le StarSystemEngine est une nouvelle couche d'intégration dans `moteur/engine/star` ; il ne prétend pas remplacer un éventuel moteur de rendu stellaire spécialisé.
