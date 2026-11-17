# Core — Lot 4 : cadence d’activité pilotée par les périvolumes

## Objectif

Appliquer les décisions du `PerivolumeManager` aux mises à jour coûteuses des moteurs de tuiles, sans modifier les calculs orbitaux ni détruire de ressources graphiques.

## Politique

`CoreActivityPolicy` traduit l’état d’un astre en cadence :

| État | Mise à jour des tuiles |
|---|---|
| `ACTIVE` | Chaque image |
| `BACKGROUND` | Une image sur quatre (configurable) |
| `UNLOADED` | Suspendue |
| Cible actuelle | Chaque image, quel que soit l’état |

Le moteur continue d’appeler `updateBodyModel()` à chaque image afin de conserver le basculement modèle/tuiles et la continuité visuelle. Les positions orbitales, les rotations et le placement de la caméra ne sont pas déplacés vers l’ordonnanceur.

## Intégration

- `SolarEngine.initCoreOrchestration()` crée `CoreActivityPolicy`.
- `updateCoreOrchestration()` avance son compteur de frame après les positions orbitales et la caméra.
- La boucle `tiledBodies` consulte l’état du périvolume avant `tb.tiles.update()`.
- Les identifiants non présents dans le registre conservent temporairement la cadence `ACTIVE` pour assurer la compatibilité.
- `dispose()` réinitialise la politique.

## Limites explicites

Ce lot suspend l’actualisation des TileManagers pour les astres `UNLOADED`, mais ne masque pas leurs objets Three.js, ne vide pas leurs caches et n’annule pas les téléchargements déjà lancés. Ces opérations nécessitent un protocole de propriété/libération par moteur et seront traitées séparément pour éviter de supprimer des textures ou géométries partagées.

Les états restent calculés à partir des rayons et positions de scène enregistrés au lot 3. Les seuils `12 × rayon` et `40 × rayon` doivent être calibrés avec des mesures de caméra et de charge réelles avant activation d’un déchargement mémoire.

## Tests

`activity-policy.test.jsx` vérifie la cadence ACTIVE, BACKGROUND, UNLOADED, la priorité du focus et le rejet d’une cadence invalide.
