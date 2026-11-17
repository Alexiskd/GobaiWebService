# Gobai Space — JPL Horizons Core, Lot 2

## Portée

Ce lot ajoute deux couches d'orchestration autonomes. Il ne modifie pas la boucle `SolarEngine.frame()` et ne change pas les seuils de LOD déjà en production dans `moteur/engine/bodyLoading.jsx`.

## LODManager

`LODManager` délègue les décisions existantes à `bodyLevel`, `planTiledBodies` et `satelliteShown`. Il centralise le calcul du niveau par astre, le budget de tuiles et l'hystérésis d'affichage des satellites. Les seuils existants restent la source de vérité.

## RenderScheduler

`RenderScheduler` exécute au plus `maxTasksPerFrame` tâches par appel à `flush()`. Les tâches les plus prioritaires passent en premier ; à priorité égale, l'ordre d'inscription est conservé. Les tâches restantes attendent les images suivantes. Une tâche peut se reprogrammer elle-même pendant son exécution. Les erreurs sont rapportées dans le résultat et au callback `onError`, sans interrompre les autres tâches sélectionnées.

## Intégration volontairement différée

Les gestionnaires sont exportés depuis `moteur/core/index.js`, mais ils ne sont pas encore branchés dans `SolarEngine`. L'étape suivante devra identifier les mises à jour coûteuses qui peuvent être déplacées dans l'ordonnanceur sans retarder les calculs physiques, les mouvements de caméra ou le rendu essentiel.

## Validation

Tests ciblés ajoutés pour le mapping des niveaux, le budget des tuiles, l'hystérésis des satellites, la priorité, la reprogrammation et la gestion des erreurs.
