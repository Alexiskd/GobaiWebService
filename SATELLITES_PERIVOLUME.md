# Satellites naturels et périvolumes

- Le catalogue JSON contient les 160 satellites listés dans le PDF fourni, avec leur planète hôte et le statut de sphéricité observée.
- Les 33 satellites disposant déjà de paramètres orbitaux dans `bodies.data.ts` sont ceux que le moteur Kepler existant peut modéliser actuellement.
- Les autres entrées sont conservées dans le catalogue avec `aKm`, `periodDays`, `radiusKm` et `horizons` à `null`. Le PDF source ne fournit pas ces valeurs : elles doivent être complétées par des données JPL/Horizons vérifiées avant d'activer leur calcul orbital.
- `SatelliteSystem` n'affiche les modèles existants que lorsque le périvolume de leur planète hôte est le périvolume actif.
- Le rendu ne dépend pas des couches de surface, nuages ou textures.
- Les données sont locales et statiques ; cette modification n'ajoute aucun appel HTTP.

## Fichiers ajoutés/modifiés

- `frontend/src/Car/SystemeEngine/data/astronomy/data/satellite-catalogue.observed.json`
- `frontend/src/Car/AstreSolideEngine/satellitePerivolume.js`
- `frontend/src/Car/AstreSolideEngine/satellitePerivolume.test.js`
- `frontend/src/Car/AstreSolideEngine/satellites.jsx`
