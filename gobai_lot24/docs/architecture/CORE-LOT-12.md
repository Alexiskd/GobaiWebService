# Lot 12 — qualification des familles candidates à l'instancing

## Objectif

Éviter les conversions automatiques d'objets Three.js qui changeraient le picking, la visibilité individuelle ou l'apparence. `InstancingEligibility.js` fournit une politique pure et testable ; elle ne modifie pas la scène et n'alloue aucun objet GPU.

## Critères

Une famille est éligible si tous ses éléments partagent exactement la même géométrie et le même matériau, et ne demandent ni raycast individualisé, ni visibilité individuelle, ni état de shader propre à l'objet. Les éléments DOM sont exclus.

## Constats sur les candidats existants

- Les repères d'astres dans `engine.jsx` sont des éléments HTML/CSS : ils ne sont pas des meshes et ne peuvent pas être convertis en `InstancedMesh`.
- Les satellites possèdent une visibilité LOD indépendante et leurs meshes sont utilisés par le raycaster : une conversion directe exige d'abord de migrer le picking vers `instanceId` et de gérer les instances masquées.
- Les couches de points (étoiles, volcans, certains marqueurs) utilisent déjà `THREE.Points`, qui regroupe leurs sommets dans un seul objet de rendu ; les remplacer par des `InstancedMesh` n'apporterait pas automatiquement un gain.

## Portée

Ce lot ajoute un rapport d'éligibilité et ses tests, sans conversion graphique automatique. Les conversions réelles sont reportées jusqu'à ce que les contrats d'interaction et de visibilité soient migrés explicitement.
