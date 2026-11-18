# Lot 6 — Cadencement des moteurs spécialisés

Le lot 6 ajoute `EngineActivityPolicy` et le raccorde à la boucle `SolarEngine`. Les moteurs spécialisés Terre (atmosphère, volcans, LiDAR, points LiDAR et annotations) et Lune (étiquettes lunaires) sont cadencés selon l'état de périvolume de leur astre.

| Moteur | ACTIVE / ciblé | BACKGROUND | UNLOADED |
|---|---:|---:|---:|
| Atmosphère | chaque image | 1/4 | suspendu |
| Volcans | chaque image | 1/4 | suspendu |
| LiDAR | chaque image | 1/3 | suspendu |
| Points LiDAR | chaque image | 1/3 | suspendu |
| Annotations Terre | chaque image | 1/2 | suspendu |
| Étiquettes Lune | chaque image | 1/2 | suspendu |

La suspension concerne les appels `update`/`sync` seulement. Les objets Three.js, textures, géométries, caches, données scientifiques et calculs orbitaux ne sont pas supprimés. Les tuiles et le basculement modèle/tuiles conservent leur traitement existant. Le moteur ciblé est toujours mis à jour à chaque image.

`getCoreDiagnostics()` expose les cadences configurées. Les tests unitaires vérifient les états, la cadence, la priorité de la cible et le rejet de profils invalides.

## Limites connues

- Les moteurs relief ne possèdent pas tous un cycle `update` autonome : ils restent pilotés par le gestionnaire de tuiles existant.
- Les systèmes d'atmosphère et LiDAR sont ici associés à la Terre, et les étiquettes lunaires à la Lune.
- Une suspension ne libère aucune mémoire ; l'éviction mémoire reste gérée par le lot 5 et les caches existants.
- Build complet et suite `tsx` à exécuter avec les dépendances installées.
