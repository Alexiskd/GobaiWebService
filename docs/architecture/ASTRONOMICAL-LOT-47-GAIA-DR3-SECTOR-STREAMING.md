# Lot 47 — Gaia DR3 Sector Streaming

## Objectif

Ajouter une première voie de chargement réel et explicite du catalogue Gaia DR3 dans l'application statique, avec cache navigateur et rendu stellaire groupé. Aucun appel catalogue n'est déclenché automatiquement au démarrage.

## Modules

- `GaiaSectorCache.js` : cache IndexedDB versionné, TTL 24 h, repli mémoire si IndexedDB est absent ou inaccessible.
- `GaiaDR3SectorStreamer.js` : requêtes Gaia TAP à la demande, limite de concurrence, annulation, déduplication des chargements et conversion de parallaxe positive en distance `pc = 1000 / parallax_mas`.
- `GaiaStarfieldLayer.js` : couche `THREE.Points` unique avec attributs de position et couleur, mise à jour de l'origine flottante.
- `engine.jsx` : API `loadGaiaDR3Cone`, `loadGaiaDR3AroundCamera`, `cancelGaiaDR3Streaming`, `getGaiaStreamingStats`.

## Référentiel et limites scientifiques

Les positions sont converties depuis RA/Dec ICRS en coordonnées cartésiennes héliocentriques avec la distance inverse de parallaxe. Les parallaxes nulles ou négatives sont exclues : aucune distance n'est inventée. Cette conversion ne corrige pas la parallaxe pour son biais statistique et ne propage pas le mouvement propre à une époque différente. Le champ Gaia utilisé est celui de la release DR3 et les positions sont affichées dans le référentiel de catalogue.

## Limites opérationnelles

- `searchGaiaCone` est un cône céleste limité à 5 degrés et plafonné par `maxRows` du service.
- Un lot ne constitue pas un téléchargement exhaustif d'un secteur spatial 3D ; il s'agit d'une tuile de ciel paramétrée par RA/Dec/rayon.
- IndexedDB peut être indisponible en navigation privée ou selon les politiques du navigateur ; le cache mémoire prend alors le relais.
- Les requêtes ESA TAP peuvent échouer selon réseau, disponibilité du service et CORS navigateur.
- Le rendu `THREE.Points` groupe les étoiles d'un lot dans un seul objet de rendu. Il ne remplace pas encore un pipeline GPU multi-tuiles, ni le chargement paginé complet du catalogue.
- Aucun proxy backend n'est introduit ; la configuration Render reste statique.

## API

```js
await engine.loadGaiaDR3Cone({ raDeg: 83.8, decDeg: -5.4, radiusDeg: 1, limit: 500 });
await engine.loadGaiaDR3AroundCamera({ radiusDeg: 1, limit: 500 });
engine.cancelGaiaDR3Streaming();
engine.getGaiaStreamingStats();
```

`loadGaiaDR3AroundCamera` déduit uniquement la direction ICRS de la caméra ; il ne calcule pas un volume spatial 3D centré sur la caméra. La caméra doit être distincte de l'origine solaire.
