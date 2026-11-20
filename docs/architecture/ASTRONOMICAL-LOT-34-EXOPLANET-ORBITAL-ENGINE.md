# Lot 34 — Exoplanet Orbital Engine

## Objectif

Calculer l'état képlérien d'une exoplanète à une date julienne donnée, dans un repère cartésien centré sur son étoile hôte. Le module est indépendant du rendu Three.js et du cycle de vie de `SolarEngine`.

## API

```js
import {
  solveKeplerEquation,
  calculateExoplanetPosition,
  calculateExoplanetRecordPosition,
  calculateExoplanetBatch,
} from './moteur/data/astronomy/index.js';

const state = calculateExoplanetPosition({
  periodDays: 11.186,
  semiMajorAxisAu: 0.0485,
  eccentricity: 0.04,
  inclinationDeg: 89,
  longitudeAscendingNodeDeg: 0,
  argumentOfPeriastronDeg: 120,
  periastronEpochJulianDate: 2459000.5,
}, 2460000.5);
```

`position` est exprimée en AU et `velocity` en AU/jour. Les angles d'orientation suivent la convention Ω (nœud ascendant), i (inclinaison), ω (argument du périastre). Les coordonnées sont centrées sur l'étoile hôte.

## Calculs

1. Détermination de l'anomalie moyenne à partir d'un temps de passage au périastre explicitement exprimé en JD, ou d'une anomalie moyenne associée à une époque JD.
2. Résolution de `E - e sin(E) = M` par Newton avec repli par dichotomie.
3. Calcul de la position et de la vitesse dans le plan orbital.
4. Rotation vers le repère de référence par Ω, i et ω.
5. Demi-grand axe fourni directement ou dérivé de la période et de la masse stellaire avec la troisième loi de Kepler (masse planétaire négligée).

## Données NASA et prudence sur les époques

Le normaliseur NASA expose `pl_orblper` comme `argumentOfPeriastronDeg` (convention publiée conservée comme « as-reported ») et `pl_orbtper` comme `timeOfPeriastronRawDays`. La documentation NASA décrit `pl_orblper` comme l'argument du périastre, avec des conventions de publication pouvant différer entre l'orbite de la planète et le mouvement réflexe de l'étoile ; elle décrit `pl_orbtper` comme un temps de périastre en jours juliens. Le code conserve ce temps brut et ne le convertit **pas automatiquement** en `periastronEpochJulianDate` : l'appelant doit valider la convention de temps (JD/BJD et référence utilisée), puis fournir `periastronEpochJulianDate` ou `meanAnomalyAtEpochDeg` avec `epochJulianDate`. Le nœud ascendant Ω n'est pas fourni par cette sélection de colonnes et doit être fourni séparément ou rester à zéro avec avertissement.

Le catalogue NASA ne fournit pas toujours tous les éléments d'orientation ou la phase orbitale. Les angles manquants sont provisoirement mis à zéro et accompagnés d'avertissements ; cela permet un aperçu géométrique, pas une orientation orbitale scientifiquement déterminée.

## Limites

- Orbites elliptiques uniquement (`0 <= e < 1`). Les trajectoires paraboliques et hyperboliques ne sont pas prises en charge.
- Pas d'intégration N-corps, de perturbations, de précession, de marées ou de résonances.
- Le calcul est képlérien à deux corps ; la masse de la planète est négligée dans la dérivation de `a`.
- Le repère de sortie est un repère orbital de référence local, pas automatiquement ICRS, équatorial apparent ou le repère monde Three.js.
- Pas encore de liaison au `Exoplanet Engine` (lot 36) ni au `Star Engine` (lot 35).
- Les tests sont analytiques/synthétiques ; aucune position de catalogue n'a été validée contre une éphéméride externe.
