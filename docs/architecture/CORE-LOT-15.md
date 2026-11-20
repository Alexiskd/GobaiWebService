# Core — Lot 15 : contrat de données de surface par instance

## Objectif

Préparer la migration future des surfaces satellites vers un rendu mutualisé sans fusionner prématurément les matériaux ni les couches de tuiles. Les `TileManager` actuels possèdent des uniforms, des textures, des états de couverture et des transitions indépendants ; les remplacer directement par un `InstancedMesh` serait incorrect sans adapter le shader et le transport des données.

## Livrable

`frontend/src/moteur/core/SatelliteSurfaceInstanceData.js` définit un contrat CPU de 16 flottants par instance, répartis en quatre attributs `vec4` :

| Attribut | Composantes |
|---|---|
| `surface0` | rayon, aplatissement, ombrage, astre sans atmosphère |
| `surface1` | mode de couche, carte couleur active, mode détail, alpha |
| `surface2` | exagération du relief, ombrage relief, relief image, océan |
| `surface3` | lumières, type de détail, facteur de fond, visibilité |

Le module permet de packer l'état, de l'écrire dans quatre buffers `Float32Array` distincts et contigus, directement adaptables à des `InstancedBufferAttribute`.

## Garanties et limites

- Les uniforms existants ne sont ni modifiés ni remplacés.
- Aucun matériau, shader ou `TileManager` n'est fusionné dans ce lot.
- Les textures de tuiles et leurs états restent indépendants.
- Les valeurs non finies et les dimensions de buffer incohérentes sont rejetées.
- Ce contrat CPU est une préparation : il ne produit pas encore de draw call instancié ni de gain GPU mesurable.

## Étape suivante

Écrire un prototype shader distinct et isolé, puis comparer son rendu à celui du `TileManager` historique sur un seul couple de satellites avant toute migration globale.
