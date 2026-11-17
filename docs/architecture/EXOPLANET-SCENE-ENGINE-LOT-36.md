# Lot 36 — Exoplanet Scene Engine

## Objectif

Transformer le modèle de systèmes stellaires du lot 35 en un modèle de scène puis en objets Three.js : étoile hôte, planètes, positions et courbes orbitales.

## Modules

- `frontend/src/moteur/engine/exoplanets/ExoplanetSceneEngine.js`
  - `buildExoplanetSceneModel(system, options)` : modèle indépendant du renderer.
  - `sampleOrbit(orbit, segments, scale)` : échantillonnage d'une ellipse képlérienne.
  - `orbitalReferenceToScene(position)` : conversion d'axes vers la convention Three.js Gobai `(x, z, -y)`.
  - `createExoplanetSystemGroup(THREE, model, options)` : construction d'un groupe Three.js, étoile, sphères planétaires et lignes d'orbite.
- `ExoplanetSceneEngine.test.js` : tests du modèle, des axes, des orbites et des cas incomplets.

## Contrat scientifique et repères

Les positions orbitales sont exprimées en AU dans un repère cartésien local `ORBITAL-REFERENCE` centré sur l'étoile hôte. Le mapping `(x,y,z) -> (x,z,-y)` ne fait que réordonner les axes pour la convention de scène Gobai ; ce n'est pas une transformation vers ICRS, J2000 ou le repère galactique. Le modèle garde cette distinction dans son champ `frame`.

Les trajectoires sont des ellipses idéales calculées à partir des éléments disponibles. Une orbite n'est pas tracée si son demi-grand axe ou son excentricité est invalide. Une position n'est pas inventée si aucune phase orbitale exploitable n'est disponible. Les tailles des sphères sont des rayons visuels compressés, pas des distances ou rayons physiques à l'échelle.

## Intégration

Le constructeur Three.js reçoit `THREE` en dépendance afin de rester testable sans contexte WebGL. Il retourne un `THREE.Group` autonome, avec `userData.updateFromModel(nextModel)` pour actualiser les positions, et `userData.dispose()` pour libérer les ressources détenues. Le groupe n'est pas encore injecté dans la boucle centrale `engine.jsx` ou `SolarScene.jsx` : le lot fournit la brique de rendu, pas une activation globale de l'interface.

## Limites

- Pas de transformation ICRS vers le repère orbital local : les éléments orbitaux sont locaux à l'étoile.
- Pas de calcul de barycentre étoile-planète ni de perturbations multi-corps.
- Pas de texture réaliste, atmosphère, éclairage physique, transit ou occultation.
- Pas de validation navigateur/WebGL dans cet environnement.
