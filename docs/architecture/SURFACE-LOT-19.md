# Lot 19 — Pont expérimental atlas → TileLayer

## But

Le lot 18 fournit des textures multi-couches et une allocation UV commune. Le lot 19 ajoute un adaptateur explicite vers les uniforms qui existent déjà dans `moteur/engine/tiles/tileLayer.jsx` et `tileShaders.jsx`.

## Correspondances prises en charge

| Canal atlas | Uniform TileLayer | Rectangle UV | Activation |
|---|---|---|---|
| `color` | `map` | `baseRect` | déjà consommée par le shader |
| `elevation` | `hMap` | `hRect` | `hHas = 1` |
| `night` | `ltMap` | `ltRect` | `ltHas = 1` |
| `normal` | — | — | en attente d'un shader normal dédié |

`composeSatelliteAtlasUvRect()` compose le rectangle d'une tuile avec celui de l'entrée atlas. L'adaptateur accepte un `tileRect` local, par défaut `[0, 0, 1, 1]`.

## Utilisation explicite

```js
import { bindSatelliteAtlasEntryToTileUniforms } from '../core/SatelliteAtlasTileBinding.js';

const result = bindSatelliteAtlasEntryToTileUniforms(atlasEntry, tileMaterial.uniforms, {
  tileRect: [0, 0, 1, 1],
});
// result.applied : canaux effectivement reliés
// result.pending : canaux non pris en charge ou uniforms absents
```

## Limites et précautions

- Cet adaptateur n'est pas appelé automatiquement par `TileLayer` et n'active aucun chargement atlas dans le moteur en production.
- L'ownership des textures reste au gestionnaire atlas. Le code appelant doit conserver l'atlas en vie tant que les matériaux référencent ses textures.
- Les canaux altitude doivent être encodés dans le format attendu par `hTex()` dans `tileShaders.jsx` (encodage Terrarium). Une image d'altitude arbitraire ne devient pas compatible par simple branchement.
- Les lumières doivent conserver le format, l'espace colorimétrique et les paramètres attendus par le shader nocturne existant.
- Les normales ne sont pas branchées : le shader TileLayer actuel ne déclare pas de sampler normal dédié.
- Aucun gain de performances, réduction de draw calls, rendu visuel ou compatibilité GPU n'est revendiqué à ce stade.
- Ne pas appeler `dispose()` sur l'atlas tant qu'un matériau utilise une de ses textures.

## Validation

Tests Node du calcul UV, du branchement des trois uniforms existants, du signalement des normales en attente et des entrées invalides. Vérification statique des imports. Le build Vite et le rendu WebGL ne sont pas validés dans cet environnement si les dépendances ne sont pas installées.
