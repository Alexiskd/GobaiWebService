# Lot 25 — Orchestration centrale du budget GPU

## Objectif

Raccorder le budget GPU des surfaces au cycle de vie de `SolarEngine` et aux décisions de `PerivolumeManager`, tout en gardant les pipelines d'atlas opt-in. Le moteur central possède l'orchestrateur et le budget ; les atlas conservent la propriété de leurs pages et textures.

## Architecture livrée

- `SatelliteGpuBudgetOrchestrator.js` crée ou reçoit un `SatelliteGpuMemoryBudgetManager`.
- `SolarEngine.initCoreOrchestration()` crée l'orchestrateur avec un budget global initial de 512 Mio et un budget par astre de 256 Mio.
- `SolarEngine.updateCoreOrchestration()` transmet les décisions `ACTIVE`, `BACKGROUND` et `UNLOADED` à l'orchestrateur. Le budget est réévalué lorsque les états de périvolume changent ; les allocations et modifications de plafonds déclenchent aussi leur propre contrôle. Cela évite de parcourir toutes les ressources à chaque frame lorsque la situation est stable.
- `SolarEngine.getSurfaceGpuBudgetManager()` expose le gestionnaire afin de construire des `SatelliteAtlasGpuBudgetBridge` compatibles.
- `SolarEngine.registerSurfaceAtlasBudgetBridge(bridge)` enregistre explicitement un bridge et renvoie une fonction de désinscription. La désinscription appelle `bridge.dispose()` ; l'atlas reste la propriété de son créateur.
- `setSurfaceGpuGlobalBudget(bytes)` et `setSurfaceGpuBodyBudget(bodyId, bytes)` permettent d'ajuster les plafonds.
- `getCoreDiagnostics()` expose `gpuMemoryBudget` : budget global, octets comptabilisés, ressources épinglées, état par astre, bridges et dernières évictions.

## Cycle de destruction

Les gestionnaires de tuiles sont détruits avant l'orchestrateur GPU. Cet ordre est important : les pipelines peuvent encore libérer des références d'atlas pendant `tiles.dispose()`. L'orchestrateur détruit ensuite les bridges, qui retirent leurs inscriptions du budget sans détruire les atlas externes.

Le bridge d'atlas supprime également son entrée locale lorsqu'un callback d'éviction détruit effectivement une page, afin d'éviter de conserver une référence de suivi périmée.

## Utilisation future d'un pipeline atlas

```js
const budgetManager = solarEngine.getSurfaceGpuBudgetManager();
const bridge = new SatelliteAtlasGpuBudgetBridge({
  atlas,
  budgetManager,
});
const unregister = solarEngine.registerSurfaceAtlasBudgetBridge(bridge);

// À la fermeture du propriétaire du pipeline :
unregister();
```

Le code ci-dessus est le contrat d'intégration. Le lot 25 ne crée pas lui-même d'atlas de production et ne passe pas automatiquement `surfaceAtlasPipeline` aux `TileLayer` existants. L'activation de l'atlas reste donc expérimentale et explicite.

## Limites et validation

- Les valeurs sont des estimations logiques, pas une mesure physique du GPU navigateur.
- Aucun atlas n'est créé automatiquement par `SolarEngine` dans ce lot.
- Les budgets par astre ne s'appliquent aux pages atlas que lorsqu'un bridge correspondant est enregistré.
- Le build Vite et la validation WebGL nécessitent l'installation des dépendances et un navigateur ; ils ne sont pas remplacés par les tests Node.
