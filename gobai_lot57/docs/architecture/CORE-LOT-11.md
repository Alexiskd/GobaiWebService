# Lot 11 — infrastructure d'instancing

## Objectif

Préparer le regroupement de meshes répétitifs partageant strictement la même géométrie et le même matériau, afin de réduire les draw calls. Le lot ajoute `InstancedMeshBatch`, wrapper léger de `THREE.InstancedMesh` avec capacité fixe et identifiants stables.

## API

- `upsert(id, matrix, color?)` ajoute ou met à jour une instance ; retourne son index, ou `false` si la capacité est atteinte.
- `remove(id)` retire une instance par compactage ; le dernier élément prend sa place.
- `has(id)` et `size` exposent l'état du batch.
- `dispose()` détruit le mesh instancié et uniquement les ressources explicitement possédées (`ownsGeometry`, `ownsMaterial`).

Les matrices sont fournies par l'appelant. Le batch ne modifie pas les transformations ni les calculs orbitaux. Géométrie et matériau sont empruntés par défaut.

## Limite volontaire de ce lot

Aucun moteur de production n'est converti automatiquement. Les objets repérés dans `ContributionLayer`, `moonOrbiters` et `lidarGlobe` n'ont pas tous les mêmes exigences de rendu (points à taille écran constante, couleurs par objet, masquage face cachée, trajectoires et cycle de vie). Les remplacer directement par des meshes instanciés changerait potentiellement leur apparence ou leur visibilité. L'intégration sera faite par famille homogène, avec validation visuelle dédiée.

## Tests

`InstancedMeshBatch.test.jsx` couvre l'upsert, la capacité, le retrait/compactage et la propriété des ressources.
