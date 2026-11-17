# Gobai Space — Offline Orbit Engine

## Objectif

Le positionnement des corps du Système solaire ne dépend plus d'un service HTTP, d'un proxy, de JPL Horizons ou d'une connexion réseau. `OfflineOrbitEngine.js` fournit une façade commune aux calculateurs analytiques locaux.

## Modèles utilisés

| Corps | Modèle local | Limites |
|---|---|---|
| Mercure à Neptune | VSOP87A local lorsque la série est disponible | Théorie analytique, pas une éphéméride DE440/DE441 |
| Pluton / corps non couverts par VSOP87A | Éléments képlériens séculaires du catalogue | Précision plus faible que les séries planétaires |
| Lune | ELP abrégée dans `planetOrbits.jsx` | Environ 0,05° en longitude et 300 km en distance selon la documentation du modèle existant |
| Satellites naturels du catalogue | Propagation circulaire locale à partir du demi-grand axe `aKm` et de la période sidérale `periodDays` | Le catalogue ne contient pas encore `e`, `i`, `Ω`, `ω` et `M0`; aucune valeur orbitale manquante n'est inventée |

Les périodes négatives sont conservées et produisent une propagation rétrograde (ex. Triton et Phœbé).

## Repères et unités

- Planètes : positions héliocentriques, sorties en UA puis conversion par le moteur de scène.
- Satellites : positions relatives au parent, en km dans l'écliptique J2000, puis conversion en rayons terrestres / repère Three.js.
- Époque de phase des satellites : J2000.0, phase initiale nulle selon la convention historique du fallback du catalogue.
- Plan de satellite : plan équatorial approximé à partir du pôle de la planète lorsque celui-ci est disponible.

## Intégration

- `SolarEngine.updateBodies()` utilise `OfflineOrbitEngine.planet()` pour chaque planète.
- `SatelliteSystem.update()` utilise `satelliteMath.jsx`, dont le fallback délègue à `calculateSatelliteRelativeKm()`.
- `useMoonFeeds()` ne lance plus de polling réseau.
- Le client direct JPL Horizons a été retiré de cette version afin d'éviter les erreurs CORS et les appels distants de positionnement.

## Précision et évolutions

Le modèle satellite actuel est un modèle de visualisation cohérent, pas une éphéméride de précision. Pour passer à une propagation képlérienne elliptique complète, enrichir chaque satellite avec des éléments orbitaux homogènes (époque, demi-grand axe, excentricité, inclinaison, longitude du nœud, argument du périastre, anomalie moyenne) et un repère de référence clairement défini. Pour les systèmes perturbés (résonances galiléennes, satellites irréguliers, systèmes binaires), utiliser ensuite des éléments osculateurs datés ou une intégration N-body locale.

## Vérifications

Le vérificateur statique d'import du projet confirme que les imports locaux existent. L'exécution des tests et le build Vite nécessitent l'installation des dépendances (`npm ci`); celle-ci n'a pas abouti dans l'environnement de génération.
