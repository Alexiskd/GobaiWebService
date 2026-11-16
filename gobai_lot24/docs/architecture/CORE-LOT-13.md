# Lot 13 — pont de picking pour les instances

## Objectif

Préparer la migration des satellites vers `THREE.InstancedMesh` sans casser leur sélection individuelle.

## Changements

- `InstancedPickRegistry` associe un `InstancedMeshBatch` à ses identifiants métier.
- La résolution lit `batch.ids[instanceId]` au moment du clic : elle reste correcte après le compactage d'instances effectué par `InstancedMeshBatch.remove()`.
- `SatelliteSystem.registerInstancedPickBatch()` refuse les identifiants qui ne correspondent pas à un satellite connu.
- `SatelliteSystem.getInstancedPickables()` expose les meshes au raycaster.
- `SatelliteSystem.resolvePickHit()` convertit une intersection Three.js en objet satellite métier.
- `SolarEngine.selectAt()` sait maintenant sélectionner un satellite via `instanceId`, tout en conservant le chemin historique `sat.mesh`.

## Limite volontaire

Aucun satellite n'est encore converti en `InstancedMesh` dans ce lot. Les meshes individuels restent utilisés pour préserver le rendu, les groupes de rotation synchrone, les tuiles, le LOD et les fonctions qui attendent `sat.mesh`. Le nouveau pont rend possible une migration progressive et testable ; il ne réduit pas encore les draw calls.

## Utilisation future

Créer un `InstancedMeshBatch` avec les identifiants de satellites, ajouter son `batch.mesh` à la scène, puis enregistrer le batch avec `satelliteSystem.registerInstancedPickBatch(batch)`. Le callback de désenregistrement doit être appelé avant de retirer le batch.
