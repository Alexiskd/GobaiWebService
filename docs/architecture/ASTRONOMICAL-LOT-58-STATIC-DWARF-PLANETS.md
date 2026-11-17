# Lot 58 — Planètes naines statiques et suppression du proxy backend

## Objectif

Précharger Hauméa, Makémaké et Éris dans le catalogue des corps du Système solaire. Leur position héliocentrique est calculée par le moteur orbital Kepler déjà présent dans le frontend. Aucun appel backend ou Horizons n'est requis pour leur affichage ou leur déplacement orbital.

## Données orbitales

Les éléments osculateurs sont issus des solutions NIMA du service LESIA / Lucky Star pour les objets 136108, 136472 et 136199, à l'époque JD 2460800.5 (2025-05-05 TDB). Ils sont ramenés au format commun du moteur (éléments J2000 avec moyen mouvement linéaire). Le calcul de scène est une propagation képlérienne à deux corps destinée à la visualisation, et non une intégration N-corps ni une éphéméride Horizons haute précision.

## Architecture statique

- Les trois entrées sont dans `frontend/src/moteur/data/astronomy/data/dwarf-planets.data.ts`.
- `bodies.data.ts` les fusionne automatiquement dans `PLANETS`, triées par demi-grand axe.
- `planetOrbits.jsx` calcule leurs positions à la date courante comme les autres corps sans série VSOP87A.
- Le dossier `backend/` et le service `gobai-astronomy-proxy` sont retirés de cette livraison.
- `render.yaml` ne déclare plus qu'un Static Site.

## Validation

Le test `dwarfPlanetStatic.test.jsx` vérifie la présence des trois corps, la validité des éléments et la production de positions 3D finies à l'époque 2026-11-17.
