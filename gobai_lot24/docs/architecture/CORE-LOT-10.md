# Core — Lot 10 : partage des géométries sphériques

## Objectif

Réduire les allocations de géométries identiques pour les sphères de fond des planètes, sans fusionner les meshes ni modifier leurs matériaux, positions, orbites ou propriétés de visibilité.

## Implémentation

- `core/SharedGeometry.js` construit une clé à partir des subdivisions horizontales et verticales.
- `acquireUnitSphereGeometry()` acquiert une `SphereGeometry` de rayon 1 dans le `SharedResourcePool`.
- `SolarEngine.initPlanets()` partage les géométries lorsque les subdivisions sont identiques.
- Le rayon de chaque astre est appliqué au `mesh.scale` ; les matériaux et groupes restent indépendants.
- Le parcours de destruction de scène ignore les géométries marquées comme partagées ; le pool les libère une seule fois à la destruction du moteur.
- L'aplatissement des géantes gazeuses multiplie désormais l'échelle Y existante au lieu de l'écraser.

## Limites

Ce lot réduit les allocations CPU et la duplication de buffers de géométrie. Il ne réduit pas à lui seul le nombre de draw calls : chaque planète conserve son mesh et son matériau. Les sphères de la Terre (128 × 96), des autres planètes (48 × 32) et de la Lune (96 × 64) restent des topologies distinctes.

Aucun InstancedMesh n'est introduit : les planètes ont des matériaux, des interactions, des groupes, des anneaux et des moteurs spécialisés distincts. Les fusionner dans une seule instance serait une modification de rendu risquée sans mesure préalable.

## Vérifications

- Contrôle syntaxique des modules JS et du moteur JSX (copie `.mjs`).
- Vérification statique des imports du projet.
- Smoke tests du partage, du comptage de références, de la libération finale et du rejet des subdivisions invalides.
- Build Vite et suite `tsx --test` non exécutés dans cet environnement, faute de dépendances installées.
