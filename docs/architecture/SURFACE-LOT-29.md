# Surface — Lot 29 : validation visuelle A/B

## Objectif

Ajouter un banc de comparaison visuelle indépendant du navigateur et du moteur de capture. L'application fournit les captures RGBA et les callbacks de cadrage/mode ; le module calcule les différences et produit un rapport exploitable.

## API

- `compareSatelliteAtlasVisualFrames(classic, atlas, options)` compare deux buffers RGBA de mêmes dimensions : différence absolue moyenne, différences par canal, maximum et ratio de pixels modifiés.
- `analyzeSatelliteAtlasTileBoundaries(frame, { vertical, horizontal })` mesure les sauts de luminance de part et d'autre des frontières connues.
- `SatelliteAtlasVisualValidationRunner` exécute les scénarios successivement en classique puis atlas, restaure le cadrage si `setView` retourne une fonction, et restaure toujours le mode initial.
- `serializeSatelliteAtlasVisualReport(report)` exporte le rapport en JSON.

## Utilisation attendue

Le consommateur fournit des scénarios avec `bodyId` et `viewKey`, puis implémente :

1. `getMode()` pour lire le mode initial ;
2. `setMode(mode, bodyId)` pour basculer uniquement l'astre visé ;
3. `setView(scenario)` pour fixer caméra, temps orbital, éclairage et état des tuiles ; peut retourner une fonction de restauration ;
4. `captureFrame({ mode, bodyId, viewKey })` pour retourner `{ width, height, data }`, avec `data` contenant exactement `width * height * 4` valeurs RGBA.

Exemple de limites : `maxMeanAbsoluteDifference: 1.5` et `maxChangedPixelRatio: 0.01`. Ces seuils sont des paramètres de départ, pas des seuils scientifiques universels ; ils doivent être calibrés sur des captures déterministes.

## Interprétation des coutures

La mesure aux frontières est descriptive. Une forte différence de luminance entre deux pixels adjacents n'est pas nécessairement une couture : elle peut correspondre à une vraie limite géographique. Le rapport doit comparer les mêmes coordonnées sur les captures classique et atlas. Le delta atlas moins classique est plus pertinent qu'une valeur absolue isolée.

## Limites

- Aucun navigateur n'est lancé et aucune capture GPU n'est effectuée par ce module.
- Le cadrage, le temps, les lumières, le chargement des tuiles et l'attente de stabilité sont à la charge de `setView`.
- Les captures sont séquentielles ; une scène animée non figée peut produire des différences non liées à l'atlas.
- Le module n'exporte pas de PNG et ne réalise pas de comparaison perceptuelle ; il compare les valeurs RGBA brutes.
- Aucune amélioration de FPS ou de qualité n'est revendiquée sans exécution réelle dans le navigateur.
