# Lot 18 — Atlas de textures multi-couches synchronisées

## Objectif

Étendre le prototype d'atlas du lot 17 à plusieurs cartes de surface qui partagent une allocation UV unique. Les canaux usuels sont `color`, `elevation`, `normal` et `night`.

## Architecture

- `SatelliteMultiLayerTextureAtlasManager` possède un allocateur spatial unique par page.
- Chaque page crée une texture indépendante par canal configuré.
- Une surface reçoit une allocation et un rectangle UV communs à toutes ses couches.
- `enqueue()` accepte les couches effectivement disponibles ; les couches absentes sont optionnelles et ne sont pas exposées dans `entry.textures`.
- Les fonctions `createPage()` et `blit()` sont injectées par canal : aucun accès DOM/WebGL n'est nécessaire pour tester la logique.
- La file est priorisée et `processQueue(maxItems)` borne le nombre de surfaces traitées par appel.

## Contrat d'intégration des canaux

Chaque canal doit fournir `createPage({ pageSize, index, channel })`, qui retourne au minimum `{ texture }`, et `blit(page, source, allocation, channel)`. Le callback `createPage` doit initialiser la page avec une valeur neutre adaptée au type de données, y compris lorsque certaines couches ne sont pas présentes :

- `color` : fond de couleur défini par le moteur de surface ;
- `elevation` : hauteur neutre/plate ;
- `normal` : normale tangentielle neutre (typiquement RGB 128, 128, 255) ;
- `night` : noir.

Pour Three.js r128, les textures de données (`elevation`, `normal`) doivent rester en espace linéaire et ne pas subir de conversion colorimétrique sRGB. La couleur visible (`color`) peut utiliser l'encodage sRGB si les sources le nécessitent. Le canal `night` dépend du pipeline de composition choisi. Le choix du format GPU, du type de données et des filtres doit rester cohérent avec les sources réelles.

## Mipmaps et filtrage

Le gestionnaire ne force pas de configuration Three.js : les callbacks créent les textures. Pour les textures utilisant des mipmaps, prévoir un gutter suffisant et une extrusion des bords dans chaque canal. Vérifier le comportement aux niveaux mipmap inférieurs ; un gutter de 4 px est une valeur de départ, pas une garantie pour tous les niveaux.

## Limites connues

- Prototype de gestion, pas encore branché sur `TileLayer` ni sur les chargements réels des astres.
- Aucune conversion automatique de données d'altitude en texture, ni génération de normales depuis une heightmap.
- Aucun shader de fusion color/elevation/normal/night n'est intégré ici.
- Les allocations libérées ne sont pas recyclées ; éviter d'écraser un rectangle encore référencé par une instance GPU.
- Les pages et leurs textures sont créées par les callbacks ; le gestionnaire ne décide pas de leur format, encodage, filtrage ou politique de mipmaps.
- Aucune réduction de draw calls ou validation visuelle n'est revendiquée à ce stade.

## Tests

`SatelliteMultiLayerTextureAtlas.test.js` vérifie la synchronisation UV, les couches optionnelles, la priorité, le budget de traitement, les erreurs de configuration et la libération des textures.
